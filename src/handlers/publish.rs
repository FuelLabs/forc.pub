use std::env;
use std::sync::{Arc, Mutex};

use crate::api::publish::PublishRequest;
use crate::db::error::DatabaseError;
use crate::db::Database;
use crate::index::handler::git::GithubRepoBuilder;
use crate::index::handler::{IndexPublishError, IndexPublisher};
use crate::models::{ApiToken, NewPackageDep};
use crate::util::load_env;
use forc_pkg::source::reg::{
    self,
    file_location::Namespace,
    index_file::{PackageDependencyIdentifier, PackageEntry},
};
use forc_pkg::PackageManifest;
use semver::Version;
use serde::Serialize;
use tempfile::TempDir;
use thiserror::Error;
use tracing::error;
use tracing::info;
use url::Url;
use uuid::Uuid;

#[derive(Error, Debug, Serialize)]
pub enum PublishError {
    #[error("Invalid Forc manifest: {0}")]
    InvalidForcManifest(String),

    #[error(transparent)]
    #[serde(skip)]
    Database(#[from] DatabaseError),

    #[error(transparent)]
    #[serde(skip)]
    Diesel(#[from] diesel::result::Error),

    #[error(transparent)]
    Index(#[from] IndexPublishError),
}

/// The information to publish.
#[derive(Debug)]
pub struct PublishInfo {
    pub package_name: String,
    pub upload_id: Uuid,
    pub num: Version,
    pub package_description: Option<String>,
    pub repository: Option<Url>,
    pub documentation: Option<Url>,
    pub homepage: Option<Url>,
    pub urls: Vec<Url>,
    pub readme: Option<String>,
    pub license: Option<String>,
}

#[derive(Clone)]
pub struct PartialPackageDep {
    pub dependency_package_name: String,
    pub dependency_version_req: String,
}

/// Publish index file for the given `PackageEntry`.
/// The `PackageEntry` is inserted into the `IndexFile` that is parsed from the
/// remote repo, which is used by forc.pub and forc to communicate. Index repo
/// can be found on GitHub.
///
/// The org name is `reg::GithubRegistryResolver::DEFAULT_REPO_ORG`.
/// The repo name is `reg::GithubRegistryResolver::DEFAULT_REPO_NAME`.
/// The file locations for the package entries are calculated using:
/// `reg::GithubRegistryResolver::DEFAULT_CHUNKING_SIZE`.
async fn publish_index_file(package_entry: PackageEntry) -> Result<(), IndexPublishError> {
    let repo_name = reg::GithubRegistryResolver::DEFAULT_REPO_NAME;
    let repo_org = reg::GithubRegistryResolver::DEFAULT_GITHUB_ORG;
    let chunk_size = reg::GithubRegistryResolver::DEFAULT_CHUNKING_SIZE;

    let tmpdir = TempDir::new().map_err(|_| {
        IndexPublishError::RepoError(
            "cannot create temporary dir for index repo fetch operation".to_string(),
        )
    })?;
    let tmp_path = tmpdir.path();
    let github_repo_builder = Arc::new(Mutex::new(GithubRepoBuilder::with_repo_details(
        repo_name, repo_org, tmp_path,
    )?));
    let github_index_publisher = crate::index::handler::git::GithubIndexPublisher::new(
        chunk_size,
        Namespace::Flat,
        github_repo_builder,
    );

    github_index_publisher.publish_entry(package_entry).await?;
    Ok(())
}
/// Handles the publishing process by:
/// 1. Parsing the forc manifest and extracting the dependencies and metadata
/// 2. Store the package version in the database
/// 3. Store the package dependencies in the database
///
/// Returns the published [PackageVersion] on success.
pub async fn handle_publish(
    db: &Database,
    request: &PublishRequest,
    token: &ApiToken,
) -> Result<PublishInfo, PublishError> {
    info!("Starting to publish upload {}", request.upload_id);

    let upload = db.transaction(|conn| conn.get_upload(request.upload_id))?;

    // For now, only package manifests are supported. Workspace manifests will be supported in the future.
    let pkg_manifest = PackageManifest::from_string(upload.forc_manifest)
        .map_err(|e| PublishError::InvalidForcManifest(e.to_string()))?;
    let pkg_version = pkg_manifest
        .project
        .version
        .ok_or(PublishError::InvalidForcManifest(
            "Project manifest must have a version".to_string(),
        ))?;

    // Validate the package dependencies.
    let package_deps = db.transaction(|conn| {
        match pkg_manifest.dependencies {
            Some(deps) => {
                let mut package_deps = vec![];
                for (name, dependency) in deps {
                    // Check if the package version exists in the database.
                    let version = dependency
                        .version()
                        .ok_or(PublishError::InvalidForcManifest(
                            "Dependency must have a version".to_string(),
                        ))?;
                    let _ = conn.get_package_version(name.clone(), version.to_string())?;

                    package_deps.push(PartialPackageDep {
                        dependency_package_name: name.clone(),
                        dependency_version_req: version.to_string(),
                    });
                }
                Ok::<_, PublishError>(package_deps)
            }
            None => Ok(vec![]),
        }
    })?;

    let publish_info = PublishInfo {
        package_name: pkg_manifest.project.name,
        upload_id: request.upload_id,
        num: pkg_version,
        package_description: pkg_manifest.project.description.clone(),
        repository: pkg_manifest.project.repository.clone(),
        documentation: pkg_manifest.project.documentation.clone(),
        homepage: pkg_manifest.project.homepage.clone(),
        urls: request.urls.clone().unwrap_or_default(),
        readme: upload.readme.clone(),
        license: Some(pkg_manifest.project.license.clone()),
    };

    load_env();
    let run_env = env::var("RUN_ENV").unwrap_or_default();

    if run_env != "local" {
        let package_name = publish_info.package_name.clone();
        let package_version = publish_info.num.clone();
        let source_cid = upload.source_code_ipfs_hash;
        let abi_cid = upload.abi_ipfs_hash;
        let dependencies = package_deps
            .iter()
            .cloned()
            .map(PackageDependencyIdentifier::from)
            .collect();
        let yanked = false;

        let package_entry = PackageEntry::new(
            package_name,
            package_version,
            source_cid,
            abi_cid,
            dependencies,
            yanked,
        );

        // Wait for index file insertion to finalize, if it fails we should not
        // insert the publish information into db.
        publish_index_file(package_entry).await?;
    }

    db.transaction(|conn| {
        // Insert package version into the database along with metadata from the package manifest.
        let package_version = conn.new_package_version(token, &publish_info)?;

        // Insert package dependencies into the database.
        let new_package_deps = package_deps
            .iter()
            .map(|dep| NewPackageDep {
                dependent_package_version_id: package_version.id,
                dependency_package_name: dep.dependency_package_name.clone(),
                dependency_version_req: dep.dependency_version_req.clone(),
            })
            .collect();
        let _ = conn.insert_dependencies(new_package_deps)?;

        // Insert package categories and keywords into the database.
        if let Some(categories) = pkg_manifest.project.categories {
            let _ = conn.insert_categories(package_version.package_id, &categories)?;
        }
        if let Some(keywords) = pkg_manifest.project.keywords {
            let _ = conn.insert_keywords(package_version.package_id, &keywords)?;
        }

        info!(
            "Successfully published package {} version {}",
            publish_info.package_name, publish_info.num
        );

        Ok(publish_info)
    })
}
