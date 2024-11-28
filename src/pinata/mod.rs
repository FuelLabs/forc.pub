use std::{env, path::Path};

use dotenvy::dotenv;
use pinata_sdk::{PinByFile, PinataApi};

use crate::upload::UploadError;

pub trait PinataClient: Sized {
    fn new() -> impl std::future::Future<Output = Result<Self, UploadError>> + Send;
    fn upload_file_to_ipfs(
        &self,
        path: &Path,
    ) -> impl std::future::Future<Output = Result<String, UploadError>> + Send;
}

pub struct PinataClientImpl {
    pinata_api: PinataApi,
}

impl PinataClient for PinataClientImpl {
    async fn new() -> Result<Self, UploadError> {
        dotenv().ok();

        let (api_key, secret_api_key) =
            match (env::var("PINATA_API_KEY"), env::var("PINATA_API_SECRET")) {
                (Ok(key), Ok(secret)) => (key, secret),
                _ => return Err(UploadError::Ipfs),
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
            Err(_) => Err(UploadError::Ipfs),
        }
    }
}

pub struct MockPinataClient;

impl PinataClient for MockPinataClient {
    async fn new() -> Result<Self, UploadError> {
        Ok(MockPinataClient)
    }

    async fn upload_file_to_ipfs(&self, _path: &Path) -> Result<String, UploadError> {
        Ok("ABC123".to_string())
    }
}
