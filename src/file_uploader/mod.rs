pub mod pinata;
pub mod s3;

use crate::file_uploader::{pinata::PinataClient, s3::S3Client};
use crate::handlers::upload::UploadError;
use std::path::Path;
use std::{fs::File, io::Read};

pub struct FileUploader<'a, T: PinataClient, E: S3Client> {
    pinata_client: &'a T,
    s3_client: &'a E,
}

impl<'a, T: PinataClient, E: S3Client> FileUploader<'a, T, E> {
    pub fn new(pinata_client: &'a T, s3_client: &'a E) -> Self {
        Self {
            pinata_client,
            s3_client,
        }
    }

    pub async fn upload_file(&self, path: &Path) -> Result<String, UploadError> {
        tracing::info!("Uploading file to IPFS: {:?}", path);
        let ipfs_hash = self.pinata_client.upload_file_to_ipfs(path).await?;

        // Read file contents
        let mut file = File::open(path).map_err(|_| UploadError::OpenFile)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|_| UploadError::ReadFile)?;

        // Upload to S3
        tracing::info!("Uploading file to S3: {:?}", path);
        self.s3_client
            .upload_file_to_s3(path, ipfs_hash.clone())
            .await?;

        Ok(ipfs_hash)
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::file_uploader::{pinata::MockPinataClient, s3::MockS3Client};
    use std::io::Write;
    use std::path::PathBuf;
    use tempfile::NamedTempFile;

    pub fn get_mock_file_uploader() -> FileUploader<'static, MockPinataClient, MockS3Client> {
        FileUploader::new(&MockPinataClient, &MockS3Client)
    }

    #[tokio::test]
    async fn test_upload_file_success() {
        let pinata_client = MockPinataClient;
        let s3_client = MockS3Client;
        let file_uploader = FileUploader::new(&pinata_client, &s3_client);

        // Create a temporary file to simulate a real file upload
        let mut temp_file = NamedTempFile::new().expect("Failed to create temp file");
        temp_file
            .write_all(b"Test file contents")
            .expect("Failed to write to temp file");
        let temp_path = temp_file.path().to_path_buf();

        let result = file_uploader.upload_file(&temp_path).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "ABC123");
    }

    #[tokio::test]
    async fn test_upload_file_ipfs_failure() {
        struct FailingPinataClient;
        impl PinataClient for FailingPinataClient {
            async fn new() -> Result<Self, UploadError> {
                Ok(FailingPinataClient)
            }
            async fn upload_file_to_ipfs(&self, _path: &Path) -> Result<String, UploadError> {
                Err(UploadError::IpfsUploadFailed("IPFS error".to_string()))
            }
        }

        let pinata_client = FailingPinataClient;
        let s3_client = MockS3Client;
        let file_uploader = FileUploader::new(&pinata_client, &s3_client);

        let temp_path = PathBuf::from("fake_file.txt");

        let result = file_uploader.upload_file(&temp_path).await;
        assert!(result.is_err());
        assert_eq!(
            result,
            Err(UploadError::IpfsUploadFailed("IPFS error".to_string()))
        );
    }

    #[tokio::test]
    async fn test_upload_file_s3_failure() {
        struct FailingS3Client;
        impl S3Client for FailingS3Client {
            async fn new() -> Result<Self, UploadError> {
                Ok(FailingS3Client)
            }
            async fn upload_file_to_s3(
                &self,
                _path: &Path,
                _file_name: String,
            ) -> Result<(), UploadError> {
                Err(UploadError::S3UploadFailed("S3 error".to_string()))
            }
        }

        let pinata_client = MockPinataClient;
        let s3_client = FailingS3Client;
        let file_uploader = FileUploader::new(&pinata_client, &s3_client);

        // Create a temporary file
        let mut temp_file = NamedTempFile::new().expect("Failed to create temp file");
        temp_file
            .write_all(b"Test file contents")
            .expect("Failed to write to temp file");
        let temp_path = temp_file.path().to_path_buf();

        let result = file_uploader.upload_file(&temp_path).await;
        assert!(result.is_err());
        assert_eq!(
            result,
            Err(UploadError::S3UploadFailed("S3 error".to_string()))
        );
    }

    #[tokio::test]
    async fn test_upload_file_open_failure() {
        let pinata_client = MockPinataClient;
        let s3_client = MockS3Client;
        let file_uploader = FileUploader::new(&pinata_client, &s3_client);

        let non_existent_path = PathBuf::from("non_existent_file.txt");

        let result = file_uploader.upload_file(&non_existent_path).await;
        assert!(result.is_err());
        assert!(matches!(result, Err(UploadError::OpenFile)));
    }
}
