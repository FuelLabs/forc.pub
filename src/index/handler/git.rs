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
    fn resolve_default_branch_name(&self) -> Result<String, IndexPublishError>;
    fn update_and_checkout_default_branch(
        &self,
        branch_name: &str,
    ) -> Result<(), IndexPublishError>;
    fn stage_and_commit_changes(&self, commit_message: &str) -> Result<(), IndexPublishError>;
    fn push_changes(&self, branch_name: &str) -> Result<(), IndexPublishError>;
    fn path(&self) -> Result<&Path, IndexPublishError>;
    fn repo(&self) -> &git2::Repository;
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

impl GitRepoBuilder for GithubRepoBuilder {
    fn repo(&self) -> &git2::Repository {
        &self.repo
    }

    fn path(&self) -> Result<&Path, IndexPublishError> {
        // `git2::Repository::path` returns the path of the underlying `.git`
        // folder.
        let git_folder = self.repo.path();
        // We need to get the actual parent/root directory.
        git_folder.parent().ok_or_else(|| {
            IndexPublishError::RepoError("internal error: invalid git repo path".to_string())
        })
    }

    fn resolve_default_branch_name(&self) -> Result<String, IndexPublishError> {
        let head_ref = self.repo().find_reference("HEAD")?;
        let branch_ref = head_ref.resolve()?;
        let branch_name = branch_ref
            .shorthand()
            .ok_or_else(|| {
                IndexPublishError::RepoError("HEAD is detached or not on a named branch".into())
            })?
            .to_string();

        Ok(branch_name)
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

const SSH_KEY_ENV_VAR: &str = "GITHUB_SSH_KEY";

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
            "unable to get private key from GITHUB_SSH_KEY env variables",
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

impl<T: GitRepoBuilder> GithubIndexPublisher<T> {
    /// Create a new GitHub index publisher.
    pub fn new(chunk_size: usize, namespace: Namespace, repo_builder: Arc<Mutex<T>>) -> Self {
        Self {
            chunk_size,
            namespace,
            repo_builder,
        }
    }

    fn process_repo(&self, package_entry: &PackageEntry) -> Result<(), IndexPublishError> {
        let repo_builder_guard = self
            .repo_builder
            .lock()
            .map_err(|e| IndexPublishError::RepoError(format!("Mutex poisoned: {}", e)))?;
        // Deref the guard to call methods on the underlying GithubRepoBuilder
        let repo_builder = &*repo_builder_guard;

        let tmp_path = repo_builder.path()?;
        let branch_name = repo_builder.resolve_default_branch_name()?;
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
        repo_builder.push_changes(&branch_name)?;

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
impl<T: GitRepoBuilder + Send + 'static> IndexPublisher for GithubIndexPublisher<T>
where
    T: GitRepoBuilder + Send + 'static,
{
    async fn publish_entry(self, package_entry: PackageEntry) -> Result<(), IndexPublishError> {
        task::spawn_blocking(move || self.process_repo(&package_entry))
            .await
            .map_err(|e| IndexPublishError::RepoError(format!("Blocking task JoinError: {}", e)))?
    }
}

// --- Mock Implementation ---
#[cfg(test)]
struct MockGithubRepoBuilder {
    repo: git2::Repository,
}

#[cfg(test)]
impl MockGithubRepoBuilder {
    // Helper to create the mock, including initializing the repo
    fn new(path: &Path) -> Self {
        // Ensure the target directory exists
        fs::create_dir_all(path).expect("Failed to create mock repo directory");
        // Initialize a bare repo so path calculations work
        let repo = git2::Repository::init_bare(path.join(".git")) // Init bare usually sufficient
            .expect("Failed to initialize mock git repository");
        Self { repo }
    }
}

#[cfg(test)]
impl GitRepoBuilder for MockGithubRepoBuilder {
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
        // `git2::Repository::path` returns the path of the underlying `.git`
        // folder.
        let git_folder = self.repo.path();
        // We need to get the actual parent/root directory.
        git_folder.parent().ok_or_else(|| {
            IndexPublishError::RepoError("internal error: invalid git repo path".to_string())
        })
    }

    fn resolve_default_branch_name(&self) -> Result<String, IndexPublishError> {
        Ok("master".to_string())
    }

    fn repo(&self) -> &git2::Repository {
        &self.repo
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use super::*; // Import necessary items from parent module
    use forc_pkg::source::reg::file_location::Namespace; // Make sure this is accessible
    use tempfile::tempdir; // Use tempfile crate

    // Helper for setting up the publisher with the mock
    fn mock_github_index_publisher(
        path: &Path,
        chunk_size: usize,
        namespace: Namespace,
    ) -> GithubIndexPublisher<MockGithubRepoBuilder> {
        // Use the MockGithubRepoBuilder constructor
        let mock_repo_builder = MockGithubRepoBuilder::new(path);
        GithubIndexPublisher::new(
            chunk_size,
            namespace,
            Arc::new(Mutex::new(mock_repo_builder)),
        )
    }

    #[tokio::test]
    async fn publish_new_entry_creates_file() {
        let tmp_dir = tempdir().unwrap();
        let repo_path = tmp_dir.path();
        println!("Test repo path: {:?}", repo_path);

        let chunk_size = 2;
        let namespace = Namespace::Flat; // Or Domain("test.com") etc.
        let publisher = mock_github_index_publisher(repo_path, chunk_size, namespace.clone());

        let name = "my-package".to_string();
        let version = semver::Version::from_str("0.1.0").unwrap();
        let source_cid = "QmHash".to_string();
        let abi_cid = None;
        let dependencies = vec![];
        let yanked = false;

        let entry = PackageEntry::new(name, version, source_cid, abi_cid, dependencies, yanked);

        // Act
        publisher.publish_entry(entry.clone()).await.unwrap();

        // Assert
        // 1. Calculate expected file path
        let expected_relative_path = location_from_root(chunk_size, &namespace, entry.name());
        let expected_file_path = repo_path.join(expected_relative_path);
        println!("Expecting file at: {:?}", expected_file_path);

        // 2. Check file exists
        assert!(
            expected_file_path.exists(),
            "Expected index file was not created at {:?}",
            expected_file_path
        );

        // 3. Check file content
        let content = fs::read_to_string(&expected_file_path).unwrap();
        let index_file_content: IndexFile =
            serde_json::from_str(&content).expect("Failed to parse JSON from index file");

        // 4. Verify the entry exists in the parsed content
        let retrieved_entry = index_file_content.get(entry.version());
        assert!(
            retrieved_entry.is_some(),
            "Entry for version {} not found in index file",
            entry.version()
        );
    }

    #[tokio::test]
    async fn publish_second_version_appends_to_file() {
        let tmp_dir = tempdir().unwrap();
        let repo_path = tmp_dir.path();
        let chunk_size = 2;
        let namespace = Namespace::Flat;

        // Setup initial state: Pre-write a file with version 0.1.0
        let name = "my-package".to_string();
        let version = semver::Version::from_str("0.1.0").unwrap();
        let source_cid = "QmHash".to_string();
        let abi_cid = None;
        let dependencies = vec![];
        let yanked = false;

        let entry_v1 = PackageEntry::new(
            name.clone(),
            version,
            source_cid.clone(),
            abi_cid.clone(),
            dependencies.clone(),
            yanked,
        );

        let relative_path = location_from_root(chunk_size, &namespace, entry_v1.name());
        let file_path = repo_path.join(&relative_path);
        fs::create_dir_all(file_path.parent().unwrap()).unwrap();
        let mut initial_index = IndexFile::default();
        initial_index.insert(entry_v1.clone());
        let initial_content = serde_json::to_string_pretty(&initial_index).unwrap();
        fs::write(&file_path, initial_content).unwrap();
        println!("Pre-wrote initial file at: {:?}", file_path);

        // Arrange publisher and new entry
        let publisher = mock_github_index_publisher(repo_path, chunk_size, namespace.clone());
        let version2 = semver::Version::from_str("0.2.0").unwrap();
        let entry_v2 = PackageEntry::new(name, version2, source_cid, abi_cid, dependencies, yanked);

        // Act
        publisher.publish_entry(entry_v2.clone()).await.unwrap();

        // Assert
        // 1. Check file exists (it should)
        assert!(file_path.exists(), "Index file should still exist");

        // 2. Check file content contains *both* versions
        let content = fs::read_to_string(&file_path).unwrap();
        let index_file_content: IndexFile =
            serde_json::from_str(&content).expect("Failed to parse JSON from index file");

        // 3. Verify both entries exist
        let retrieved_entry_v1 = index_file_content.get(entry_v1.version());
        let retrieved_entry_v2 = index_file_content.get(entry_v2.version());

        assert!(
            retrieved_entry_v1.is_some(),
            "Entry for version 0.1.0 missing"
        );

        assert!(
            retrieved_entry_v2.is_some(),
            "Entry for version 0.2.0 missing"
        );
    }

    #[tokio::test]
    async fn publish_same_version_returns_error() {
        let tmp_dir = tempdir().unwrap();
        let repo_path = tmp_dir.path();
        let chunk_size = 2;
        let namespace = Namespace::Flat;

        // Setup initial state: Pre-write a file with version 0.1.0
        let name = "my-package".to_string();
        let version = semver::Version::from_str("0.1.0").unwrap();
        let source_cid = "QmHash".to_string();
        let abi_cid = None;
        let dependencies = vec![];
        let yanked = false;

        let entry_v1 = PackageEntry::new(name, version, source_cid, abi_cid, dependencies, yanked);

        let relative_path = location_from_root(chunk_size, &namespace, entry_v1.name());
        let file_path = repo_path.join(&relative_path);
        fs::create_dir_all(file_path.parent().unwrap()).unwrap();
        let mut initial_index = IndexFile::default();
        initial_index.insert(entry_v1.clone());
        let initial_content = serde_json::to_string_pretty(&initial_index).unwrap();
        fs::write(&file_path, &initial_content).unwrap();

        // Arrange publisher and the *same* entry again
        let publisher = mock_github_index_publisher(repo_path, chunk_size, namespace.clone());

        // Act
        let result = publisher.publish_entry(entry_v1.clone()).await;

        // Assert
        assert!(result.is_err(), "Expected publish_entry to return an error");
        match result.err().unwrap() {
            IndexPublishError::VersionCollision(name, version) => {
                assert_eq!(name, entry_v1.name());
                let version = semver::Version::from_str(&version).unwrap();
                assert_eq!(version, *entry_v1.version());
            }
            e => panic!("Expected VersionCollision error, but got {:?}", e),
        }

        // Assert file content hasn't changed from initial state
        let content_after = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content_after.trim(), initial_content.trim());
    }
}
