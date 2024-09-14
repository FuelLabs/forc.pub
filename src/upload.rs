use crate::models::NewUpload;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use pinata_sdk::{PinByFile, PinataApi};
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::process::Command;
use std::env;
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
) -> Result<NewUpload, UploadError> {
    eprintln!("upload_id: {:?}", upload_id);

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

    eprintln!("forc_path: {:?}", forc_path);

    let output = Command::new(format!("{}/bin/forc", forc_path.to_string_lossy()))
        .arg("build")
        .arg("--release")
        .current_dir(&unpacked_dir)
        .output()
        .expect("Failed to execute forc build");

    if output.status.success() {
        println!("Successfully built project with forc");
    } else {
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

    if output.status.success() {
        println!("Successfully copied project files");
    } else {
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
    let tarball_ipfs_hash = upload_file_to_ipfs(&final_tarball_path).await?;

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
            let hash = upload_file_to_ipfs(&abi_path).await?;

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

async fn upload_file_to_ipfs(path: &PathBuf) -> Result<String, UploadError> {
    match (env::var("PINATA_API_KEY"), env::var("PINATA_API_SECRET")) {
        (Ok(api_key), Ok(secret_api_key)) => {
            // TODO: move to server context

            let api =
                PinataApi::new(api_key, secret_api_key).map_err(|_| UploadError::Authentication)?;
            api.test_authentication()
                .await
                .map_err(|_| UploadError::Authentication)?;

            match api.pin_file(PinByFile::new(path.to_string_lossy())).await {
                Ok(pinned_object) => Ok(pinned_object.ipfs_hash),
                Err(_) => Err(UploadError::Ipfs),
            }
        }
        _ => {
            // TODO: fallback to a local IPFS node for tests
            Err(UploadError::Ipfs)
        }
    }
}
