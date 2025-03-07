use crate::{handlers::upload::UploadError, util::load_env};
use aws_sdk_s3::Client;
use aws_sdk_s3::{
    config::{BehaviorVersion, Region, Credentials},
    primitives::ByteStream,
};
use std::{env, fs::File, io::Read, path::Path};

pub trait S3Client: Sized {
    fn new() -> impl std::future::Future<Output = Result<Self, UploadError>> + Send;
    fn upload_file_to_s3(
        &self,
        path: &Path,
        file_name: String,
    ) -> impl std::future::Future<Output = Result<(), UploadError>> + Send;
}

pub struct S3ClientImpl {
    s3_client: Client,
    bucket_name: String,
}

impl S3Client for S3ClientImpl {
    async fn new() -> Result<Self, UploadError> {
        load_env();

        // TODO: load credentials from environment variables

        // let credentials = Credentials::new("ACCESS_KEY", "SECRET_KEY", None, None, "custom-provider");

        let bucket_name = env::var("S3_BUCKET_NAME")
            .map_err(|_| UploadError::S3UploadFailed("Missing S3_BUCKET_NAME".to_string()))?;
        let bucket_region = env::var("S3_BUCKET_REGION")
            .map_err(|_| UploadError::S3UploadFailed("Missing S3_BUCKET_REGION".to_string()))?;

        let shared_config = aws_config::defaults(BehaviorVersion::v2024_03_28())
            .region(Region::new(bucket_region))
            .profile_name("forcpub")
            // .credentials_provider(credentials)
            .load()
            .await;
        let s3_client = Client::new(&shared_config);

        Ok(S3ClientImpl {
            s3_client,
            bucket_name,
        })
    }

    /// Uploads a file at the given path to an S3 bucket.
    async fn upload_file_to_s3(&self, path: &Path, file_name: String) -> Result<(), UploadError> {
        // Read file contents
        let mut file = File::open(path).map_err(|_| UploadError::OpenFile)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|_| UploadError::ReadFile)?;

        // Upload to S3
        // self.s3_client
        //     .put_object()
        //     .bucket(&self.bucket_name)
        //     .key(&file_name)
        //     .body(ByteStream::from(buffer))
        //     .send()
        //     .await
        //     .map_err(|e| UploadError::S3UploadFailed(format!("{:?}", e)))?;
        Ok(())
    }
}

/// A mock implementation of the S3Client trait for testing.
#[cfg(test)]
pub struct MockS3Client;

#[cfg(test)]
impl S3Client for MockS3Client {
    async fn new() -> Result<Self, UploadError> {
        Ok(MockS3Client)
    }

    async fn upload_file_to_s3(&self, _path: &Path, _file_name: String) -> Result<(), UploadError> {
        Ok(())
    }
}
