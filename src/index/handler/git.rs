use crate::index::{
    handler::{IndexPublishError, IndexPublisher},
    location::{location_from_root, LocationConfiguration, Namespace},
    PackageEntry,
};
use async_trait::async_trait;
use git2::{Cred, FetchOptions, Oid, PushOptions, RemoteCallbacks, Repository, Signature};
use std::env;
use std::fs;
use std::path::Path;
use tempfile::TempDir;
use tokio::task;

/// Index publishing backend for GitHub.
pub struct GithubIndexPublisher {
    /// SSH URL of the GitHub repo (e.g. git@github.com:username/repo.git)
    repo_url: String,
    /// Path to the SSH private key
    ssh_key_path: String,
    /// Configuration for file location calculation
    location_config: LocationConfiguration,
}

impl GithubIndexPublisher {
    /// Create a new GitHub index publisher.
    pub fn new(
        repo_url: String,
        ssh_key_path: String,
        location_config: LocationConfiguration,
    ) -> Self {
        Self {
            repo_url,
            ssh_key_path,
            location_config,
        }
    }

    /// Create a new GitHub index publisher using the default SSH key (~/.ssh/id_ed25519).
    pub fn with_default_key(repo_url: String, location_config: LocationConfiguration) -> Self {
        let home_dir = env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let ssh_key_path = format!("{}/.ssh/id_ed25519", home_dir);
        Self {
            repo_url,
            ssh_key_path,
            location_config,
        }
    }

    /// Gets the SSH key passphrase from environment variable
    fn get_ssh_passphrase(&self) -> Option<String> {
        env::var("SSH_KEY_PASSPHRASE").ok()
    }

    /// Process the GitHub repository and publish the package entry.
    fn process_repo(&self, package_entry: &PackageEntry) -> Result<(), IndexPublishError> {
        let repo_url = &self.repo_url;
        let ssh_key_path = &self.ssh_key_path;
        let key_passphrase = self.get_ssh_passphrase();

        // Create a temporary directory
        let tmp_dir = TempDir::new().map_err(|e| {
            IndexPublishError::FileSystemError(format!("Failed to create temp dir: {}", e))
        })?;
        let tmp_path = tmp_dir.path();

        // Configure callbacks for SSH authentication
        let mut callbacks = RemoteCallbacks::new();
        let ssh_key_path_clone = ssh_key_path.clone();
        let key_passphrase_clone = key_passphrase.clone();

        callbacks.credentials(move |_url, username_from_url, _allowed_types| {
            Cred::ssh_key(
                username_from_url.unwrap_or("git"),
                None,
                Path::new(&ssh_key_path_clone),
                key_passphrase_clone.as_deref(),
            )
        });

        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);

        let repo = git2::build::RepoBuilder::new()
            .fetch_options(fetch_opts)
            .clone(&repo_url, tmp_path)
            .map_err(|e| {
                IndexPublishError::CloneError(format!("Failed to clone repository: {}", e))
            })?;

        let head_ref = repo.head().map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to get HEAD: {}", e))
        })?;
        let branch_name = head_ref.shorthand().unwrap_or("HEAD");

        self.update_and_checkout_default_branch(&repo, branch_name)?;
        self.write_package_entry(tmp_path, package_entry)?;

        let commit_message = match &self.location_config.namespace {
            Namespace::Flat => format!(
                "Add package {} version {}",
                package_entry.name, package_entry.version
            ),
            Namespace::Domain(domain) => format!(
                "Add package {}/{} version {}",
                domain, package_entry.name, package_entry.version
            ),
        };

        self.stage_and_commit_changes(&repo, &commit_message)?;

        // Push changes to remote
        self.push_changes(&repo, branch_name)?;

        Ok(())
    }

    /// Updates the repository to the latest state and checks out the default branch
    fn update_and_checkout_default_branch(
        &self,
        repo: &Repository,
        branch_name: &str,
    ) -> Result<(), IndexPublishError> {
        // Configure SSH authentication for fetch
        let mut callbacks = RemoteCallbacks::new();
        let ssh_key_path_clone = self.ssh_key_path.clone();
        let key_passphrase = self.get_ssh_passphrase();

        callbacks.credentials(move |_url, username_from_url, _allowed_types| {
            Cred::ssh_key(
                username_from_url.unwrap_or("git"),
                None,
                Path::new(&ssh_key_path_clone),
                key_passphrase.as_deref(),
            )
        });

        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);

        // Fetch from origin to get latest changes
        let mut remote = repo.find_remote("origin").map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to find remote: {}", e))
        })?;

        remote
            .fetch(
                &["refs/heads/*:refs/remotes/origin/*"],
                Some(&mut fetch_opts),
                None,
            )
            .map_err(|e| {
                IndexPublishError::FetchError(format!("Failed to fetch latest changes: {}", e))
            })?;

        // Find the remote branch reference
        let remote_ref_name = format!("refs/remotes/origin/{}", branch_name);
        let remote_ref = repo.find_reference(&remote_ref_name).map_err(|e| {
            IndexPublishError::UnexpectedError(format!(
                "Failed to find reference {}: {}",
                remote_ref_name, e
            ))
        })?;

        let commit_oid = remote_ref.target().ok_or_else(|| {
            IndexPublishError::UnexpectedError("Failed to get target OID".to_string())
        })?;

        // Reset to remote state to ensure clean state
        let obj = repo.find_object(commit_oid, None).map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to find object: {}", e))
        })?;

        repo.reset(&obj, git2::ResetType::Hard, None).map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to reset repository: {}", e))
        })?;

        // Checkout
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        // Force checkout to ensure clean state
        checkout_builder.force();
        repo.checkout_tree(&obj, Some(&mut checkout_builder))
            .map_err(|e| {
                IndexPublishError::UnexpectedError(format!("Failed to checkout tree: {}", e))
            })?;

        repo.set_head(&format!("refs/heads/{}", branch_name))
            .map_err(|e| {
                IndexPublishError::UnexpectedError(format!("Failed to set HEAD: {}", e))
            })?;

        Ok(())
    }

    /// Write the package entry to the appropriate location in the repository
    fn write_package_entry(
        &self,
        repo_path: &Path,
        package_entry: &PackageEntry,
    ) -> Result<(), IndexPublishError> {
        // Calculate the file location using the location module
        let relative_path = location_from_root(&self.location_config, package_entry);
        let package_path = repo_path.join(&relative_path);

        // Create parent directories if they don't exist
        if let Some(parent) = package_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                IndexPublishError::FileSystemError(format!("Failed to create directories: {}", e))
            })?;
        }

        // Convert the package entry to a string representation (e.g., JSON)
        let entry_content = serde_json::to_string_pretty(package_entry).map_err(|e| {
            IndexPublishError::PackageDataError(format!("Failed to serialize package entry: {}", e))
        })?;

        // Check if the package already exists and handle versioning
        if package_path.exists() {
            // Read existing package entries
            let existing_content = fs::read_to_string(&package_path).map_err(|e| {
                IndexPublishError::FileSystemError(format!(
                    "Failed to read existing package: {}",
                    e
                ))
            })?;

            // TODO: PARSE FILE and Check for version collision
            if existing_content.contains(&format!("\"version\":\"{}\",", package_entry.version)) {
                return Err(IndexPublishError::VersionCollision(
                    package_entry.name.clone(),
                    package_entry.version.to_string(),
                ));
            }

            // Append the new entry (assuming entries are separated by newlines)
            let updated_content = format!("{}\n{}", existing_content, entry_content);
            fs::write(package_path, updated_content).map_err(|e| {
                IndexPublishError::FileSystemError(format!("Failed to write package entry: {}", e))
            })?;
        } else {
            // Write the new entry
            fs::write(package_path, entry_content).map_err(|e| {
                IndexPublishError::FileSystemError(format!("Failed to write package entry: {}", e))
            })?;
        }

        Ok(())
    }

    /// Stages and commits all changes
    fn stage_and_commit_changes(
        &self,
        repo: &Repository,
        commit_message: &str,
    ) -> Result<Oid, IndexPublishError> {
        // Add all changes to index
        let mut index = repo.index().map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to get index: {}", e))
        })?;

        // Add all files
        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .map_err(|e| {
                IndexPublishError::UnexpectedError(format!("Failed to add files to index: {}", e))
            })?;

        // Check if there are any changes
        let status = repo.statuses(None).map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to get status: {}", e))
        })?;

        if status.is_empty() {
            return Err(IndexPublishError::NoChanges);
        }

        // Write index
        index.write().map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to write index: {}", e))
        })?;

        // Create tree from index
        let tree_id = index.write_tree().map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to write tree: {}", e))
        })?;

        let tree = repo.find_tree(tree_id).map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to find tree: {}", e))
        })?;

        // Get the current HEAD commit to use as parent
        let head = repo.head().map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to get HEAD: {}", e))
        })?;

        let head_target = head.target().ok_or_else(|| {
            IndexPublishError::UnexpectedError("Couldn't get HEAD target".to_string())
        })?;

        let parent_commit = repo.find_commit(head_target).map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to find commit: {}", e))
        })?;

        // Create the signature for the commit
        let signature =
            Signature::now("Package Index", "package-index@example.com").map_err(|e| {
                IndexPublishError::UnexpectedError(format!("Failed to create signature: {}", e))
            })?;

        // Create the commit
        let commit_id = repo
            .commit(
                Some("HEAD"),      // Update HEAD reference
                &signature,        // Author
                &signature,        // Committer
                commit_message,    // Commit message
                &tree,             // Tree
                &[&parent_commit], // Parents
            )
            .map_err(|e| {
                IndexPublishError::UnexpectedError(format!("Failed to create commit: {}", e))
            })?;

        Ok(commit_id)
    }

    /// Pushes changes to the remote GitHub repository
    fn push_changes(&self, repo: &Repository, branch_name: &str) -> Result<(), IndexPublishError> {
        let mut remote = repo.find_remote("origin").map_err(|e| {
            IndexPublishError::UnexpectedError(format!("Failed to find remote: {}", e))
        })?;

        // Configure callbacks for SSH authentication
        let mut callbacks = RemoteCallbacks::new();
        let ssh_key_path_clone = self.ssh_key_path.clone();
        let key_passphrase = self.get_ssh_passphrase();

        callbacks.credentials(move |_url, username_from_url, _allowed_types| {
            Cred::ssh_key(
                username_from_url.unwrap_or("git"),
                None,
                Path::new(&ssh_key_path_clone),
                key_passphrase.as_deref(),
            )
        });

        let mut push_options = PushOptions::new();
        push_options.remote_callbacks(callbacks);

        // Push to remote
        remote
            .push(
                &[format!(
                    "refs/heads/{}:refs/heads/{}",
                    branch_name, branch_name
                )],
                Some(&mut push_options),
            )
            .map_err(|e| {
                // Try to determine if it's an authentication error
                let error_message = e.to_string().to_lowercase();
                if error_message.contains("authentication")
                    || error_message.contains("auth")
                    || error_message.contains("credentials")
                    || error_message.contains("permission")
                {
                    IndexPublishError::AuthenticationError(e.to_string())
                } else {
                    IndexPublishError::PushError(format!("Failed to push changes: {}", e))
                }
            })?;

        Ok(())
    }
}

#[async_trait]
impl IndexPublisher for GithubIndexPublisher {
    async fn publish_entry(self, package_entry: PackageEntry) -> Result<(), IndexPublishError> {
        task::spawn_blocking(move || self.process_repo(&package_entry))
            .await
            .map_err(|e| IndexPublishError::ConnectionLost(format!("Task join error: {}", e)))?
    }
}
