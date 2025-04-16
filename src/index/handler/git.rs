use crate::index::handler::{IndexPublishError, IndexPublisher};
use async_trait::async_trait;
use forc_pkg::source::reg::{
    file_location::{location_from_root, Namespace},
    index_file::{IndexFile, PackageEntry},
};
use git2::{FetchOptions, PushOptions, RemoteCallbacks, Signature};
use std::{
    env, fs,
    path::Path,
    sync::{Arc, Mutex},
};
use tokio::task;

/// Index publishing backend for GitHub.
pub struct GithubIndexPublisher<T: GitRepoBuilder> {
    chunk_size: usize,
    namespace: Namespace,
    /// Repo builder has reference to undelying libgit2 repository pointer.
    /// Which means it is not `Sync` (but `Send`). That makes it important to
    /// ensure no lock-free access happens to the repo builder from different
    /// threads.
    repo_builder: Arc<Mutex<T>>,
}

pub trait GitRepoBuilder {
    fn clone_and_resolve_head(&self) -> Result<git2::Reference<'a>, IndexPublishError>;
    fn update_and_checkout_default_branch(
        &self,
        branch_name: &str,
    ) -> Result<(), IndexPublishError>;
    fn stage_and_commit_changes(&self, commit_message: &str) -> Result<(), IndexPublishError>;
    fn push_changes(&self, branch_name: &str) -> Result<(), IndexPublishError>;
    fn path(&self) -> Result<&Path, IndexPublishError>;
}

pub struct GithubRepoBuilder {
    repo: git2::Repository,
}

impl GithubRepoBuilder {
    pub fn new(repo: git2::Repository) -> Self {
        Self { repo }
    }

    pub fn with_repo_details(
        repo_name: &str,
        repo_owner: &str,
        repo_path: &Path,
    ) -> Result<Self, IndexPublishError> {
        let repo_url = format!("git@github.com:{}/{}.git", repo_owner, repo_name);

        // Configure callbacks for SSH authentication
        let callbacks = remote_callbacks();

        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);

        let repo = git2::build::RepoBuilder::new()
            .fetch_options(fetch_opts)
            .clone(&repo_url, repo_path)
            .map_err(|e| {
                IndexPublishError::RepoError(format!("Failed to clone repository: {}", e))
            })?;

        Ok(Self { repo })
    }
}

impl<'a> GitRepoBuilder<'a> for GithubRepoBuilder {
    fn path(&self) -> Result<&Path, IndexPublishError> {
        // `git2::Repository::path` returns the path of the underlying `.git`
        // folder.
        let git_folder = self.repo.path();
        // We need to get the actual parent/root directory.
        git_folder.parent().ok_or_else(|| {
            IndexPublishError::RepoError("internal error: invalid git repo path".to_string())
        })
    }

    fn clone_and_resolve_head(&'a self) -> Result<git2::Reference<'a>, IndexPublishError> {
        let head_ref = self
            .repo
            .head()
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to get HEAD: {}", e)))?;
        Ok(head_ref)
    }

    fn update_and_checkout_default_branch(
        &self,
        branch_name: &str,
    ) -> Result<(), IndexPublishError> {
        // Configure SSH authentication for fetch
        let callbacks = remote_callbacks();

        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);

        // Fetch from origin to get latest changes
        let mut remote = self
            .repo
            .find_remote("origin")
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to find remote: {}", e)))?;

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
        let remote_ref = self.repo.find_reference(&remote_ref_name).map_err(|e| {
            IndexPublishError::RepoError(format!(
                "Failed to find reference {}: {}",
                remote_ref_name, e
            ))
        })?;

        let commit_oid = remote_ref
            .target()
            .ok_or_else(|| IndexPublishError::RepoError("Failed to get target OID".to_string()))?;

        // Reset to remote state to ensure clean state
        let obj = self
            .repo
            .find_object(commit_oid, None)
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to find object: {}", e)))?;

        self.repo
            .reset(&obj, git2::ResetType::Hard, None)
            .map_err(|e| {
                IndexPublishError::RepoError(format!("Failed to reset repository: {}", e))
            })?;

        // Checkout
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        // Force checkout to ensure clean state
        checkout_builder.force();
        self.repo
            .checkout_tree(&obj, Some(&mut checkout_builder))
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to checkout tree: {}", e)))?;

        self.repo
            .set_head(&format!("refs/heads/{}", branch_name))
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to set HEAD: {}", e)))?;

        Ok(())
    }

    fn stage_and_commit_changes(&self, commit_message: &str) -> Result<(), IndexPublishError> {
        // Add all changes to index
        let mut index = self
            .repo
            .index()
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to get index: {}", e)))?;

        // Add all files
        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .map_err(|e| {
                IndexPublishError::RepoError(format!("Failed to add files to index: {}", e))
            })?;

        // Check if there are any changes
        let status = self
            .repo
            .statuses(None)
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to get status: {}", e)))?;

        if status.is_empty() {
            return Err(IndexPublishError::NoChanges);
        }

        // Write index
        index
            .write()
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to write index: {}", e)))?;

        // Create tree from index
        let tree_id = index
            .write_tree()
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to write tree: {}", e)))?;

        let tree = self
            .repo
            .find_tree(tree_id)
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to find tree: {}", e)))?;

        // Get the current HEAD commit to use as parent
        let head = self
            .repo
            .head()
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to get HEAD: {}", e)))?;

        let head_target = head
            .target()
            .ok_or_else(|| IndexPublishError::RepoError("Couldn't get HEAD target".to_string()))?;

        let parent_commit = self
            .repo
            .find_commit(head_target)
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to find commit: {}", e)))?;

        // Create the signature for the commit
        let signature = Signature::now("Package Index", "forc-pub@fuel.sh").map_err(|e| {
            IndexPublishError::RepoError(format!("Failed to create signature: {}", e))
        })?;

        // Create the commit
        let commit_id = self
            .repo
            .commit(
                Some("HEAD"),      // Update HEAD reference
                &signature,        // Author
                &signature,        // Committer
                commit_message,    // Commit message
                &tree,             // Tree
                &[&parent_commit], // Parents
            )
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to create commit: {}", e)))?;

        tracing::debug!("Created a local commit, id: {commit_id}");

        Ok(())
    }

    fn push_changes(&self, branch_name: &str) -> Result<(), IndexPublishError> {
        let mut remote = self
            .repo
            .find_remote("origin")
            .map_err(|e| IndexPublishError::RepoError(format!("Failed to find remote: {}", e)))?;

        // Configure callbacks for SSH authentication
        let callbacks = remote_callbacks();

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
        tracing::debug!("Pushed to the remote repo");
        Ok(())
    }
}

const SSH_KEY_ENV_VAR: &str = "SSH_KEY";

/// A git credentials handler specifically for reading the ssh key or its path
/// from `SSH_KEY` environment variable.
pub fn git_credentials_callback(
    _user: &str,
    user_from_url: Option<&str>,
    _cred: git2::CredentialType,
) -> Result<git2::Cred, git2::Error> {
    let user = user_from_url.unwrap_or("git");

    match env::var(SSH_KEY_ENV_VAR) {
        Ok(k) => {
            let key_path = std::path::Path::new(&k);

            if key_path.exists() {
                git2::Cred::ssh_key(user, None, key_path, None)
            } else {
                git2::Cred::ssh_key_from_memory(user, None, &k, None)
            }
        }
        _ => Err(git2::Error::from_str(
            "unable to get private key from SSH_KEY env variables",
        )),
    }
}

/// Configure callbacks for SSH authentication and return an `RemoteCallbacks`
/// Ready to be used with any authentication process.
fn remote_callbacks() -> RemoteCallbacks<'static> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(git_credentials_callback);
    callbacks
}

impl<'a, T: GitRepoBuilder<'a>> GithubIndexPublisher<'a, T> {
    /// Create a new GitHub index publisher.
    pub fn new(chunk_size: usize, namespace: Namespace, repo_builder: Arc<Mutex<&'a T>>) -> Self {
        Self {
            chunk_size,
            namespace,
            repo_builder,
        }
    }

    fn process_repo(&self, package_entry: &PackageEntry) -> Result<(), IndexPublishError> {
        let repo_builder = self
            .repo_builder
            .try_lock()
            .map_err(|e| IndexPublishError::RepoError(e.to_string()))?;
        let tmp_path = repo_builder.path()?;
        let head_ref = repo_builder.clone_and_resolve_head()?;
        let branch_name = head_ref.shorthand().unwrap_or("HEAD");
        repo_builder.update_and_checkout_default_branch(&branch_name)?;
        self.write_package_entry(tmp_path, package_entry)?;

        let commit_message = match &self.namespace {
            Namespace::Flat => format!(
                "Add package {} version {}",
                package_entry.name(),
                package_entry.version()
            ),
            Namespace::Domain(domain) => format!(
                "Add package {}/{} version {}",
                domain,
                package_entry.name(),
                package_entry.version()
            ),
        };

        repo_builder.stage_and_commit_changes(&commit_message)?;
        repo_builder.push_changes(branch_name)?;

        Ok(())
    }
    /// Write the package entry to the appropriate location in the repository
    fn write_package_entry(
        &self,
        repo_path: &Path,
        package_entry: &PackageEntry,
    ) -> Result<(), IndexPublishError> {
        // Calculate the file location using the location module
        let relative_path =
            location_from_root(self.chunk_size, &self.namespace, package_entry.name());
        let package_path = repo_path.join(&relative_path);

        // Create parent directories if they don't exist
        if let Some(parent) = package_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Check if the package already exists and handle versioning
        if package_path.exists() {
            // Read existing package entries
            let existing_content = fs::read_to_string(&package_path)?;

            let mut index_file: IndexFile = serde_json::from_str(&existing_content)?;

            if index_file.get(package_entry.version()).is_some() {
                return Err(IndexPublishError::VersionCollision(
                    package_entry.name().to_string(),
                    package_entry.version().to_string(),
                ));
            }

            index_file.insert(package_entry.clone());
            let new_content = serde_json::to_string(&index_file)?;

            fs::write(package_path, new_content)?;
        } else {
            // Write the new entry
            let mut index_file = IndexFile::default();
            index_file.insert(package_entry.clone());
            let new_content = serde_json::to_string(&index_file)?;
            fs::write(package_path, new_content)?;
        }

        Ok(())
    }
}

#[async_trait]
impl IndexPublisher for GithubIndexPublisher<'_, GithubRepoBuilder> {
    async fn publish_entry(self, package_entry: PackageEntry) -> Result<(), IndexPublishError> {
        // Clone the Arc for the blocking task (cheap)
        let builder_arc = Arc::clone(&self.repo_builder);
        let namespace = self.namespace.clone();
        let chunk_size = self.chunk_size;

        // Move the Arc clone and other data into spawn_blocking
        task::spawn_blocking(move || {
            // Call the static blocking function, passing a reference to the Mutex inside the Arc
            GithubIndexPublisher::process_repo_blocking(
                &builder_arc,
                &namespace,
                chunk_size,
                &package_entry,
            )
        })
        .await
        .map_err(|e| IndexPublishError::RepoError(format!("Blocking task JoinError: {}", e)))??
    }
}

#[cfg(test)]
struct MockGithubRepoBuilder {
    repo: git2::Repository,
}

#[cfg(test)]
impl<'a> GitRepoBuilder<'a> for MockGithubRepoBuilder {
    fn clone_and_resolve_head(&'a self) -> Result<git2::Reference<'a>, IndexPublishError> {
        Ok(self.repo.head().unwrap())
    }

    fn update_and_checkout_default_branch(
        &self,
        _branch_name: &str,
    ) -> Result<(), IndexPublishError> {
        Ok(())
    }

    fn stage_and_commit_changes(&self, _commit_message: &str) -> Result<(), IndexPublishError> {
        Ok(())
    }

    fn push_changes(&self, _branch_name: &str) -> Result<(), IndexPublishError> {
        Ok(())
    }

    fn path(&self) -> Result<&std::path::Path, IndexPublishError> {
        Ok(self.repo.path().parent().unwrap())
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use forc_pkg::source::reg::file_location::Namespace;

    use super::{GithubIndexPublisher, MockGithubRepoBuilder};

    fn mock_github_index_publisher<'a>(
        path: &Path,
        chunk_size: usize,
        namespace: Namespace,
    ) -> GithubIndexPublisher<'a, MockGithubRepoBuilder> {
        let repo = git2::Repository::init(path).unwrap();
        let mock_repo_builder = MockGithubRepoBuilder { repo };
        GithubIndexPublisher::new(chunk_size, namespace, &mock_repo_builder)
    }

    #[test]
    fn index_file_write_test() {}
}
