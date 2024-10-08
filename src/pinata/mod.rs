use std::{env, path::PathBuf};

use dotenvy::dotenv;
use pinata_sdk::{PinByFile, PinataApi};

use crate::upload::UploadError;

pub trait PinataClient: Sized {
    fn new() -> impl std::future::Future<Output = Result<Self, UploadError>> + Send;
    fn upload_file_to_ipfs(
        &self,
        path: &PathBuf,
    ) -> impl std::future::Future<Output = Result<String, UploadError>> + Send;
}

pub struct PinataClientImpl {
    pinata_api: PinataApi,
}

impl PinataClient for PinataClientImpl {
    async fn new() -> Result<Self, UploadError> {
        dotenv().ok();
        match (env::var("PINATA_API_KEY"), env::var("PINATA_API_SECRET")) {
            (Ok(api_key), Ok(secret_api_key)) => {
                let api = PinataApi::new(api_key, secret_api_key)
                    .map_err(|_| UploadError::Authentication)?;
                api.test_authentication()
                    .await
                    .map_err(|_| UploadError::Authentication)?;
                return Ok(PinataClientImpl { pinata_api: api });
            }
            _ => {
                return Err(UploadError::Ipfs);
            }
        }
    }

    /// Uploads a file at the given path to a Pinata IPFS gateway.
    async fn upload_file_to_ipfs(&self, path: &PathBuf) -> Result<String, UploadError> {
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
    fn new() -> impl std::future::Future<Output = Result<Self, UploadError>> + Send {
        async { Ok(MockPinataClient) }
    }

    fn upload_file_to_ipfs(
        &self,
        _path: &PathBuf,
    ) -> impl std::future::Future<Output = Result<String, UploadError>> + Send {
        async { Ok("ABC123".to_string()) }
    }
}
