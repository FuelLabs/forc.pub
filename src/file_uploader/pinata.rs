use crate::{
    handlers::upload::{UploadError, TARBALL_NAME},
    util::load_env,
};
use pinata_sdk::{PinByFile, PinataApi};
use std::{env, path::Path};

pub trait PinataClient: Sized {
    fn new() -> impl std::future::Future<Output = Result<Self, UploadError>> + Send;
    fn upload_file_to_ipfs(
        &self,
        path: &Path,
    ) -> impl std::future::Future<Output = Result<String, UploadError>> + Send;
    fn fetch_ipfs_content(
        &self,
        ipfs_hash: &str,
    ) -> impl std::future::Future<Output = Result<Vec<u8>, UploadError>> + Send;
}

pub struct PinataClientImpl {
    pinata_api: PinataApi,
}

impl PinataClient for PinataClientImpl {
    async fn new() -> Result<Self, UploadError> {
        load_env();

        let (api_key, secret_api_key) =
            match (env::var("PINATA_API_KEY"), env::var("PINATA_API_SECRET")) {
                (Ok(key), Ok(secret)) => (key, secret),
                _ => return Err(UploadError::IpfsUploadFailed("Missing API key".to_string())),
            };
        let api =
            PinataApi::new(api_key, secret_api_key).map_err(|_| UploadError::Authentication)?;

        api.test_authentication()
            .await
            .map_err(|_| UploadError::Authentication)?;

        Ok(PinataClientImpl { pinata_api: api })
    }

    /// Uploads a file at the given path to a Pinata IPFS gateway.
    async fn upload_file_to_ipfs(&self, path: &Path) -> Result<String, UploadError> {
        match self
            .pinata_api
            .pin_file(PinByFile::new(path.to_string_lossy()))
            .await
        {
            Ok(pinned_object) => Ok(pinned_object.ipfs_hash),
            Err(err) => Err(UploadError::IpfsUploadFailed(err.to_string())),
        }
    }

    /// Fetches content from IPFS using the provided hash.
    async fn fetch_ipfs_content(&self, ipfs_hash: &str) -> Result<Vec<u8>, UploadError> {
        let pinata_domain = env::var("PINATA_URL").expect("PINATA_URL must be set");
        let url = format!("{pinata_domain}/ipfs/{ipfs_hash}");
        
        let response = reqwest::get(&url)
            .await
            .map_err(|e| UploadError::IpfsUploadFailed(format!("Failed to fetch from IPFS: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(UploadError::IpfsUploadFailed(format!(
                "IPFS fetch failed with status: {}",
                response.status()
            )));
        }
        
        response
            .bytes()
            .await
            .map(|bytes| bytes.to_vec())
            .map_err(|e| UploadError::IpfsUploadFailed(format!("Failed to read IPFS content: {}", e)))
    }
}

pub fn ipfs_hash_to_abi_url(hash: &str) -> String {
    let pinata_domain = env::var("PINATA_URL").expect("PINATA_URL must be set");
    format!("{pinata_domain}/ipfs/{hash}")
}

pub fn ipfs_hash_to_tgz_url(hash: &str) -> String {
    let pinata_domain = env::var("PINATA_URL").expect("PINATA_URL must be set");
    format!("{pinata_domain}/ipfs/{hash}?filename={TARBALL_NAME}")
}

/// A mock implementation of the PinataClient trait for testing.
#[cfg(test)]
pub struct MockPinataClient;

#[cfg(test)]
impl PinataClient for MockPinataClient {
    async fn new() -> Result<Self, UploadError> {
        Ok(MockPinataClient)
    }

    async fn upload_file_to_ipfs(&self, _path: &Path) -> Result<String, UploadError> {
        Ok("ABC123".to_string())
    }

    async fn fetch_ipfs_content(&self, _ipfs_hash: &str) -> Result<Vec<u8>, UploadError> {
        Ok(r#"{"abi": "mock"}"#.as_bytes().to_vec())
    }
}
