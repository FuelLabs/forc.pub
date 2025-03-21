use crate::file_uploader::FileUploader;
use crate::file_uploader::{pinata::PinataClient, s3::S3Client};
use crate::models::NewUpload;
use flate2::{
    Compression,
    {read::GzDecoder, write::GzEncoder},
};
use forc_util::bytecode::get_bytecode_id;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::Command;
use tar::Archive;
use thiserror::Error;
use tracing::error;
use uuid::Uuid;

const UNPACKED_DIR: &str = "unpacked";
const RELEASE_DIR: &str = "out/release";
const PROJECT_DIR: &str = "project";
const README_FILE: &str = "README.md";
const FORC_MANIFEST_FILE: &str = "Forc.toml";
const MAX_UPLOAD_SIZE_STR: &str = "10MB";
pub const TARBALL_NAME: &str = "project.tgz";

#[derive(Error, Debug, PartialEq, Eq)]
pub enum UploadError {
    #[error("Failed to create temporary directory.")]
    CreateTempDir,

    #[error("Failed to remove temporary directory.")]
    RemoveTempDir,

    #[error(
        "The project exceeded the maximum upload size of {}.",
        MAX_UPLOAD_SIZE_STR
    )]
    TooLarge,

    #[error("Failed to save zip file.")]
    SaveFile,

    #[error("Failed to open file.")]
    OpenFile,

    #[error("Failed to read file.")]
    ReadFile,

    #[error("Failed to copy files.")]
    CopyFiles,

    #[error("Invalid Forc version: {0}")]
    InvalidForcVersion(String),

    #[error("Failed to compile project.")]
    FailedToCompile,

    #[error("Failed to authenticate.")]
    Authentication,

    #[error("Failed to upload to IPFS. Err: {0}")]
    IpfsUploadFailed(String),

    #[error("Failed to upload to S3. Err: {0}")]
    S3UploadFailed(String),

    #[error("Failed to generate bytecode ID. Err: {0}")]
    BytecodeId(String),

    #[error("Architecture '{0}' not supported.")]
    UnsupportedArch(String),

    #[error("OS '{0}' not supported.")]
    UnsupportedOs(String),

    #[error("Upload does not contain a Forc manifest.")]
    MissingForcManifest,
}

/// Handles the project upload process by:
/// 1. Unpacking the tarball, compiling the project
/// 2. Copying the necessary files to a new directory
/// 3. Storing the source code tarball and ABI file in IPFS
///
/// Returns a [NewUpload] with the necessary information to store in the database.
pub async fn handle_project_upload<'a>(
    upload_dir: &'a Path,
    upload_id: &Uuid,
    orig_tarball_path: &PathBuf,
    forc_path: &Path,
    forc_version: String,
    file_uploader: &FileUploader<'a, impl PinataClient, impl S3Client>,
) -> Result<NewUpload, UploadError> {
    let unpacked_dir = upload_dir.join(UNPACKED_DIR);
    let release_dir = unpacked_dir.join(RELEASE_DIR);
    let project_dir = upload_dir.join(PROJECT_DIR);

    // Unpack the tarball.
    let tarball = File::open(orig_tarball_path).map_err(|_| UploadError::OpenFile)?;
    let decompressed = GzDecoder::new(tarball);
    let mut archive = Archive::new(decompressed);
    archive
        .unpack(&unpacked_dir)
        .map_err(|_| UploadError::OpenFile)?;

    // Remove `out` directory if it exists.
    let _ = fs::remove_dir_all(unpacked_dir.join("out"));

    let output = Command::new(format!("{}/bin/forc", forc_path.to_string_lossy()))
        .arg("build")
        .arg("--release")
        .current_dir(&unpacked_dir)
        .output()
        .map_err(|err| {
            error!("Failed to execute forc build: {:?}", err);
            UploadError::FailedToCompile
        })?;

    if !output.status.success() {
        return Err(UploadError::FailedToCompile);
    }

    // Copy files that are part of the Sway project to a new directory.
    let output = Command::new("rsync")
        .args([
            "-av",
            "--prune-empty-dirs",
            "--include=*/",
            "--include=Forc.toml",
            "--include=Forc.lock",
            "--include=README.md",
            "--include=*.sw",
            "--exclude=*",
            "unpacked/",
            "project",
        ])
        .current_dir(upload_dir)
        .output()
        .map_err(|err| {
            error!("Failed to copy project files: {:?}", err);
            UploadError::CopyFiles
        })?;

    if !output.status.success() {
        return Err(UploadError::CopyFiles);
    }

    // Pack the new tarball.
    let final_tarball_path = upload_dir.join(TARBALL_NAME);
    let tar_gz = File::create(&final_tarball_path).map_err(|_| UploadError::OpenFile)?;
    let enc = GzEncoder::new(tar_gz, Compression::default());
    let mut tar = tar::Builder::new(enc);

    // Add files to the tar archive
    tar.append_dir_all(".", &project_dir)
        .map_err(|_| UploadError::CopyFiles)?;

    // Finish writing the tar archive
    tar.finish().map_err(|_| UploadError::CopyFiles)?;

    // Make sure the GzEncoder finishes and flushes all data
    let enc = tar.into_inner().map_err(|_| UploadError::CopyFiles)?;
    enc.finish().map_err(|_| UploadError::CopyFiles)?;

    // Store the tarball in IPFS.
    let tarball_ipfs_hash = file_uploader.upload_file(&final_tarball_path).await?;

    fn find_file_in_dir_by_suffix(dir: &Path, suffix: &str) -> Option<PathBuf> {
        let dir = fs::read_dir(dir).ok()?;
        dir.flatten()
            .filter_map(|entry| {
                let path = entry.path();
                if path.is_file() {
                    if let Some(file_name) = path.file_name() {
                        if let Some(file_name_str) = file_name.to_str() {
                            // Check if the path is a file and ends with the suffix
                            if file_name_str.ends_with(suffix) {
                                return Some(path); // Return the first found file
                            }
                        }
                    }
                }
                None
            })
            .next()
    }

    // Store the ABI in IPFS.
    let abi_ipfs_hash = match find_file_in_dir_by_suffix(&release_dir, "-abi.json") {
        Some(abi_path) => Some(file_uploader.upload_file(&abi_path).await?),
        None => None,
    };

    // Generate the bytecode identifier and store in the database along with the ABI hash.
    let bytecode_identifier = match find_file_in_dir_by_suffix(&release_dir, ".bin") {
        Some(bin_path) => Some(
            get_bytecode_id(&bin_path).map_err(|err| UploadError::BytecodeId(err.to_string()))?,
        ),
        None => None,
    };

    // Load the contents of readme and Forc.toml into memory for storage in the database.
    let readme = fs::read_to_string(project_dir.join(README_FILE)).ok();
    let forc_manifest = fs::read_to_string(project_dir.join(FORC_MANIFEST_FILE))
        .map_err(|_| UploadError::MissingForcManifest)?;

    let upload = NewUpload {
        id: *upload_id,
        source_code_ipfs_hash: tarball_ipfs_hash,
        forc_version,
        abi_ipfs_hash,
        bytecode_identifier,
        readme,
        forc_manifest,
    };

    Ok(upload)
}

/// Installs the given version of forc at the specific root path using cargo-binstall.
pub fn install_forc_at_path(forc_version: &str, forc_path: &Path) -> Result<(), UploadError> {
    let os = match std::env::consts::OS {
        "linux" => "linux",
        "macos" => "darwin",
        _ => return Err(UploadError::UnsupportedOs(std::env::consts::OS.to_string())),
    };
    let arch = match std::env::consts::ARCH {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        _ => {
            return Err(UploadError::UnsupportedArch(
                std::env::consts::ARCH.to_string(),
            ))
        }
    };

    let output = Command::new("cargo")
    .arg("binstall")
    .arg("--no-confirm")
    .arg("--root")
    .arg(forc_path)
    .arg(format!("--pkg-url=https://github.com/FuelLabs/sway/releases/download/{forc_version}/forc-binaries-{os}_{arch}.tar.gz"))
    .arg("--bin-dir=forc-binaries/forc")
    .arg("--pkg-fmt=tgz")
    .arg(format!("forc@{forc_version}"))
    .output()
    .map_err(|err| {
        error!("Failed to install forc with binstall: {:?}", err);
        UploadError::InvalidForcVersion(forc_version.to_string())
    })?;

    if !output.status.success() {
        error!("Failed to install forc: {:?}", output);
        Err(UploadError::InvalidForcVersion(forc_version.to_string()))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_uploader::get_mock_file_uploader;
    use serial_test::serial;

    #[tokio::test]
    #[serial]
    async fn handle_project_upload_success() {
        let upload_id = Uuid::new_v4();
        let upload_dir = PathBuf::from("tmp/uploads/").join(upload_id.to_string());
        let orig_tarball_path = PathBuf::from("tests/fixtures/sway-project.tgz");
        let forc_version = "0.66.6";
        let forc_path_str = format!("forc-{forc_version}");
        let forc_path = PathBuf::from(&forc_path_str);
        fs::create_dir_all(forc_path.clone()).ok();
        let forc_path = fs::canonicalize(forc_path.clone()).expect("forc path ok");
        install_forc_at_path(forc_version, &forc_path).expect("forc installed");

        let mock_file_uploader = get_mock_file_uploader();

        let result = handle_project_upload(
            &upload_dir,
            &upload_id,
            &orig_tarball_path,
            &forc_path,
            forc_version.to_string(),
            &mock_file_uploader,
        )
        .await
        .expect("result ok");

        assert_eq!(result.id, upload_id);
        assert_eq!(result.source_code_ipfs_hash, "ABC123".to_string());
        assert_eq!(result.abi_ipfs_hash, Some("ABC123".to_string()));
        assert_eq!(result.forc_version, forc_version);
        assert_eq!(
            result.bytecode_identifier.unwrap(),
            "009683afb9a422c3d23aeafce43e3a8e29099d8d64d55c63cf8179af3f8112de"
        );
    }
}
