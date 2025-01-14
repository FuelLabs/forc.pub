use crate::{
    models::PackagePreview,
    pinata::{ipfs_hash_to_abi_url, ipfs_hash_to_tgz_url},
};
use serde::Serialize;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RecentPackagesResponse {
    pub recently_created: Vec<PackagePreview>,
    pub recently_updated: Vec<PackagePreview>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FullPackage {
    #[serde(flatten)]
    pub package_preview: PackagePreview,

    // Metadata from Uploads table
    pub bytecode_identifier: Option<String>,
    pub forc_version: String,

    // IPFS URLs
    pub source_code_ipfs_url: String,
    pub abi_ipfs_url: Option<String>,

    // Version Metadata
    pub repository: Option<String>,
    pub documentation: Option<String>,
    pub homepage: Option<String>,
    pub urls: Vec<String>,
    pub readme: Option<String>,
    pub license: Option<String>,
}

impl From<crate::models::FullPackage> for FullPackage {
    fn from(full_package: crate::models::FullPackage) -> Self {
        FullPackage {
            package_preview: PackagePreview {
                name: full_package.name,
                version: full_package.version,
                description: full_package.description,
                created_at: full_package.created_at,
                updated_at: full_package.updated_at,
            },
            bytecode_identifier: full_package.bytecode_identifier,
            forc_version: full_package.forc_version,
            source_code_ipfs_url: ipfs_hash_to_tgz_url(&full_package.source_code_ipfs_hash),
            abi_ipfs_url: full_package
                .abi_ipfs_hash
                .map(|hash| ipfs_hash_to_abi_url(&hash)),
            repository: full_package.repository,
            documentation: full_package.documentation,
            homepage: full_package.homepage,
            urls: full_package.urls.into_iter().flatten().collect(),
            license: full_package.license,
            readme: full_package.readme,
        }
    }
}
