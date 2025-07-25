use crate::{
    file_uploader::pinata::{ipfs_hash_to_abi_url, ipfs_hash_to_tgz_url},
    models::PackagePreview,
};
use serde::Serialize;
use url::Url;

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

    // Inline ABI data (only populated when requested)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub abi: Option<serde_json::Value>,

    // Version Metadata
    pub repository: Option<Url>,
    pub documentation: Option<Url>,
    pub homepage: Option<Url>,
    pub urls: Vec<Url>,
    pub readme: Option<String>,
    pub license: Option<String>,
}

impl From<crate::models::FullPackage> for FullPackage {
    fn from(full_package: crate::models::FullPackage) -> Self {
        fn string_to_url(s: String) -> Option<Url> {
            Url::parse(&s).ok()
        }

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
            abi: None, // Will be populated when inline_abi is requested
            repository: full_package.repository.and_then(string_to_url),
            documentation: full_package.documentation.and_then(string_to_url),
            homepage: full_package.homepage.and_then(string_to_url),
            urls: full_package
                .urls
                .into_iter()
                .flatten()
                .filter_map(string_to_url)
                .collect(),
            license: full_package.license,
            readme: full_package.readme,
        }
    }
}
