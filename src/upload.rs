use crate::models::NewUpload;
use crate::pinata::{PinataClient};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::process::Command;
use tar::Archive;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum UploadError {
    #[error("The project is too large to be uploaded.")]
    TooLarge,
    #[error("Failed to save zip file.")]
    SaveFile,
    #[error("Failed to copy files.")]
    CopyFiles,
    #[error("Invalid Forc version: {0}")]
    InvalidForcVersion(String),
    #[error("Not a Sway project.")]
    InvalidProject,
    #[error("Failed to authenticate.")]
    Authentication,
    #[error("Failed to upload to IPFS.")]
    Ipfs,
}

pub async fn handle_project_upload(
    upload_dir: &Path,
    upload_id: &Uuid,
    orig_tarball_path: &PathBuf,
    forc_path: &PathBuf,
    forc_version: String,
    pinata_client: &impl PinataClient,
) -> Result<NewUpload, UploadError> {
    let unpacked_dir = upload_dir.join("unpacked");
    let release_dir = unpacked_dir.join("out/release");
    let project_dir = upload_dir.join("project");

    // Unpack the tarball.
    let tarball = File::open(orig_tarball_path).unwrap();
    let decompressed = GzDecoder::new(tarball);
    let mut archive = Archive::new(decompressed);
    archive.unpack(&unpacked_dir).unwrap();

    // Remove `out` directory if it exists.
    let _ = fs::remove_dir_all(unpacked_dir.join("out"));

    let output = Command::new(format!("{}/bin/forc", forc_path.to_string_lossy()))
        .arg("build")
        .arg("--release")
        .current_dir(&unpacked_dir)
        .output()
        .expect("Failed to execute forc build");

    if !output.status.success() {
        return Err(UploadError::InvalidProject);
    }

    // Copy files that are part of the Sway project to a new directory.
    let output = Command::new("rsync")
        .args([
            "-av",
            "--prune-empty-dirs",
            "--include=*/",
            "--include=Forc.toml",
            "--include=Forc.lock",
            "--include=*.sw",
            "--exclude=*",
            "unpacked/",
            "project",
        ])
        .current_dir(upload_dir)
        .output()
        .expect("Failed to copy project files");

    if !output.status.success() {
        return Err(UploadError::CopyFiles);
    }

    // Pack the new tarball.
    let final_tarball_path = upload_dir.join("project.tgz");
    let tar_gz = File::create(&final_tarball_path).unwrap();
    let enc = GzEncoder::new(tar_gz, Compression::default());
    let mut tar = tar::Builder::new(enc);

    // Add files to the tar archive
    tar.append_dir_all(".", &project_dir).unwrap();

    // Finish writing the tar archive
    tar.finish().unwrap();

    // Make sure the GzEncoder finishes and flushes all data
    let enc = tar.into_inner().unwrap();
    enc.finish().unwrap();

    // Store the tarball in IPFS.
    let tarball_ipfs_hash = pinata_client
        .upload_file_to_ipfs(&final_tarball_path)
        .await?;

    fn find_abi_file_in_dir(dir: &Path) -> Option<PathBuf> {
        if let Ok(dir) = fs::read_dir(dir) {
            // Iterate over the directory's contents
            for entry in dir {
                if let Ok(entry) = entry {
                    let path = entry.path();

                    // Check if the path is a file and ends with "-abi.json"
                    if path.is_file() {
                        if let Some(file_name) = path.file_name() {
                            if let Some(file_name_str) = file_name.to_str() {
                                if file_name_str.ends_with("-abi.json") {
                                    return Some(path); // Return the first found file
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    // Store the ABI in IPFS.
    let (abi_ipfs_hash, bytecode_identifier) =
        if let Some(abi_path) = find_abi_file_in_dir(&release_dir) {
            let hash = pinata_client.upload_file_to_ipfs(&abi_path).await?;

            // TODO: https://github.com/FuelLabs/forc.pub/issues/16 Calculate the bytecode identifier and store in the database along with the ABI hash.
            let bytecode_identifier = None;

            (Some(hash), bytecode_identifier)
        } else {
            (None, None)
        };

    let upload = NewUpload {
        id: *upload_id,
        source_code_ipfs_hash: tarball_ipfs_hash,
        forc_version,
        abi_ipfs_hash,
        bytecode_identifier,
    };

    Ok(upload)
}

#[cfg(test)]
mod tests {
    use crate::pinata::MockPinataClient;

    use super::*;

    #[tokio::test]
    async fn handle_project_upload_success() {
        let upload_id = Uuid::new_v4();
        let upload_dir = PathBuf::from("tmp/uploads/").join(upload_id.to_string());
        let orig_tarball_path = PathBuf::from("tests/fixtures/sway-project.tgz");
        let forc_version = "0.63.4";
        let forc_path = PathBuf::from("tests/fixtures/forc-0.63.4")
            .canonicalize()
            .unwrap();
        let mock_client = MockPinataClient::new().await.expect("mock pinata client");

        let result = handle_project_upload(
            &upload_dir,
            &upload_id,
            &orig_tarball_path,
            &forc_path,
            forc_version.to_string(),
            &mock_client,
        )
        .await
        .expect("result ok");

        assert!(result.id == upload_id);
        assert_eq!(result.source_code_ipfs_hash, "ABC123".to_string());
        assert_eq!(result.abi_ipfs_hash, Some("ABC123".to_string()));
        assert!(result.forc_version == forc_version);
        // TODO: https://github.com/FuelLabs/forc.pub/issues/16
        // assert!(result.bytecode_identifier.is_some());
    }
}
