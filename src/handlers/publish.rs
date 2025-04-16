use crate::api::publish::PublishRequest;
use crate::db::error::DatabaseError;
use crate::db::Database;
use crate::index::handler::{IndexPublishError, IndexPublisher};
use crate::models::{ApiToken, NewPackageDep};
use forc_pkg::source::reg::{
    self,
    file_location::Namespace,
    index_file::{PackageDependencyIdentifier, PackageEntry},
};
use forc_pkg::PackageManifest;
use semver::Version;
use thiserror::Error;
use tracing::error;
use tracing::info;
use url::Url;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum PublishError {
    #[error("Invalid Forc manifest: {0}")]
    InvalidForcManifest(String),

    #[error(transparent)]
    Database(#[from] DatabaseError),

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

pub struct PartialPackageDep {
    pub dependency_package_name: String,
    pub dependency_version_req: String,
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

    let upload = db.conn().get_upload(request.upload_id)?;

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
    let package_deps = match pkg_manifest.dependencies {
        Some(deps) => {
            let mut package_deps = vec![];
            for (name, dependency) in deps {
                // Check if the package version exists in the database.
                let version = dependency
                    .version()
                    .ok_or(PublishError::InvalidForcManifest(
                        "Dependency must have a version".to_string(),
                    ))?;
                let _ = db
                    .conn()
                    .get_package_version(name.clone(), version.to_string())?;

                package_deps.push(PartialPackageDep {
                    dependency_package_name: name.clone(),
                    dependency_version_req: version.to_string(),
                });
            }
            package_deps
        }
        None => vec![],
    };

    // Insert package version into the database along with metadata from the package manifest.
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
    let package_version = db.conn().new_package_version(token, &publish_info)?;

    // Insert package dependencies into the database.
    let new_package_deps = package_deps
        .iter()
        .map(|dep| NewPackageDep {
            dependent_package_version_id: package_version.id,
            dependency_package_name: dep.dependency_package_name.clone(),
            dependency_version_req: dep.dependency_version_req.clone(),
        })
        .collect();
    let _ = db.conn().insert_dependencies(new_package_deps)?;

    // Insert package categories and keywords into the database.
    if let Some(categories) = pkg_manifest.project.categories {
        let _ = db
            .conn()
            .insert_categories(package_version.package_id, &categories)?;
    }
    if let Some(keywords) = pkg_manifest.project.keywords {
        let _ = db
            .conn()
            .insert_keywords(package_version.package_id, &keywords)?;
    }

    info!(
        "Successfully published package {} version {}",
        publish_info.package_name, publish_info.num
    );

    let package_name = publish_info.package_name.clone();
    let package_version = publish_info.num.clone();
    let source_cid = upload.source_code_ipfs_hash;
    let abi_cid = upload.abi_ipfs_hash;
    let dependencies = package_deps
        .into_iter()
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

    let repo_name = reg::GithubRegistryResolver::DEFAULT_REPO_NAME;
    let repo_org = reg::GithubRegistryResolver::DEFAULT_GITHUB_ORG;
    let chunk_size = reg::GithubRegistryResolver::DEFAULT_CHUNKING_SIZE;

    let github_index_publisher = crate::index::handler::git::GithubIndexPublisher::new(
        repo_org.to_string(),
        repo_name.to_string(),
        chunk_size,
        Namespace::Flat,
    );

    github_index_publisher.publish_entry(package_entry).await?;
    Ok(publish_info)
}
