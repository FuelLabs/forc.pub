//! Note: Integration tests for the database module assume that the database is running and that the DATABASE_URL environment variable is set.
//! This should be done by running `docker compose up -d db` before running the tests.

use std::vec;

use chrono::Utc;
use diesel::RunQueryDsl as _;
use forc_pub::api;
use forc_pub::api::pagination::Pagination;
use forc_pub::db::Database;
use forc_pub::handlers::publish::PublishInfo;
use forc_pub::models::{FullPackage, NewUpload, PackageVersion};
use semver::Version;
use serial_test::serial;
use url::Url;

// Test constants
const TEST_GITHUB_ID_1: &str = "1";
const TEST_LOGIN_1: &str = "AliceBobbins";
const TEST_FULL_NAME_1: &str = "Alice Bobbins";
const TEST_EMAIL_1: &str = "alice@bob.com";
const TEST_URL_1: &str = "url1.url";
const TEST_URL_2: &str = "url2.url";
const TEST_LOGIN_2: &str = "foobar";
const TEST_TOKEN_NAME_1: &str = "test token 1";
const TEST_TOKEN_NAME_2: &str = "test token 2";
const TEST_URL_REPO: &str = "https://example.com/repository";
const TEST_URL_DOC: &str = "https://example.com/documentation";
const TEST_URL_HOME: &str = "https://example.com/homepage";
const TEST_URL_OTHER: &str = "https://example.com/other";
const TEST_VERSION_1: &str = "0.1.0";
const TEST_VERSION_2: &str = "0.2.0";
const TEST_VERSION_3: &str = "0.3.0";
const TEST_PACKAGE_NAME: &str = "test-package";
const TEST_DESCRIPTION: &str = "test-description";
const TEST_README: &str = "test-readme";
const TEST_MANIFEST: &str = "test-manifest";
const TEST_LICENSE: &str = "test-license";

fn setup_db() -> Database {
    let mut db = Database::new();
    clear_tables(&mut db);
    db
}

fn clear_tables(db: &mut Database) {
    db.transaction(|conn| {
        diesel::delete(forc_pub::schema::package_versions::table).execute(conn.inner())?;
        diesel::delete(forc_pub::schema::packages::table).execute(conn.inner())?;
        diesel::delete(forc_pub::schema::api_tokens::table).execute(conn.inner())?;
        diesel::delete(forc_pub::schema::sessions::table).execute(conn.inner())?;
        diesel::delete(forc_pub::schema::users::table).execute(conn.inner())?;
        Ok::<(), diesel::result::Error>(())
    })
    .expect("clear tables");
}

fn mock_user_1() -> api::auth::User {
    api::auth::User {
        github_login: TEST_LOGIN_1.to_string(),
        github_id: TEST_GITHUB_ID_1.to_string(),
        full_name: TEST_FULL_NAME_1.to_string(),
        email: Some(TEST_EMAIL_1.to_string()),
        avatar_url: Some(TEST_URL_1.to_string()),
        github_url: TEST_URL_2.to_string(),
        is_admin: true,
    }
}

fn mock_user_2() -> api::auth::User {
    api::auth::User {
        github_login: TEST_LOGIN_2.to_string(),
        ..Default::default()
    }
}

#[serial]
#[test]
fn test_user_sessions() {
    let db = &mut setup_db();
    let _ = db.transaction(|conn| {
        // Set up session, user, token, and upload.

        let user1 = mock_user_1();
        let user2 = mock_user_2();

        let session1 = conn.new_user_session(&user1, 1000).expect("result is ok");

        // Insert an existing user
        let session2 = conn.new_user_session(&user1, 1000).expect("result is ok");

        // Insert another user
        let session3 = conn.new_user_session(&user2, 1000).expect("result is ok");

        let result = conn
            .get_user_for_session(session1.id)
            .expect("result is ok");
        assert_eq!(result.github_login, TEST_LOGIN_1);
        assert_eq!(result.full_name, TEST_FULL_NAME_1);
        assert_eq!(result.email.expect("is some"), TEST_EMAIL_1);
        assert_eq!(result.avatar_url.expect("is some"), TEST_URL_1);
        assert_eq!(result.github_url, TEST_URL_2);
        assert!(result.is_admin);

        let result = conn
            .get_user_for_session(session2.id)
            .expect("result is ok");
        assert_eq!(result.github_login, TEST_LOGIN_1);

        let result = conn
            .get_user_for_session(session3.id)
            .expect("result is ok");
        assert_eq!(result.github_login, TEST_LOGIN_2);
        Ok::<(), diesel::result::Error>(())
    });
}

#[test]
#[serial]
fn test_api_tokens() {
    let db = &mut setup_db();
    let _ = db.transaction(|conn| {
        // Set up session, user, token, and upload.
        let session = conn
            .new_user_session(&mock_user_1(), 1000)
            .expect("session is ok");
        let user = conn.get_user_for_session(session.id).expect("result is ok");

        // Insert tokens
        let (token1, plain_token1) = conn
            .new_token(user.id, TEST_TOKEN_NAME_1.into())
            .expect("result is ok");
        let (token2, plain_token2) = conn
            .new_token(user.id, TEST_TOKEN_NAME_2.into())
            .expect("result is ok");

        assert_eq!(token1.friendly_name, TEST_TOKEN_NAME_1);
        assert_eq!(token1.expires_at, None);
        assert_eq!(token2.friendly_name, TEST_TOKEN_NAME_2);
        assert_eq!(token2.expires_at, None);

        // Test token hashing
        assert_eq!(token1, conn.get_token(plain_token1).expect("test token 1"));
        assert_eq!(token2, conn.get_token(plain_token2).expect("test token 2"));

        // Get tokens
        let tokens = conn.get_tokens_for_user(user.id).expect("result is ok");
        assert_eq!(tokens.len(), 2);

        // Delete tokens
        conn.delete_token(user.id, token1.id.into())
            .expect("result is ok");
        let tokens = conn.get_tokens_for_user(user.id).expect("result is ok");
        assert_eq!(tokens.len(), 1);
        conn.delete_token(user.id, token2.id.into())
            .expect("result is ok");
        let tokens = conn.get_tokens_for_user(user.id).expect("result is ok");
        assert_eq!(tokens.len(), 0);
        Ok::<(), diesel::result::Error>(())
    });
}

#[test]
#[serial]
fn test_package_versions() {
    let db = &mut setup_db();
    let (token, user, upload) = db
        .transaction(|conn| {
            // Set up session, user, token, and upload.
            let session = conn
                .new_user_session(&mock_user_1(), 1000)
                .expect("session is ok");
            let user = conn.get_user_for_session(session.id).expect("user is ok");
            let (token, _) = conn
                .new_token(user.id, "test token".to_string())
                .expect("token is ok");
            let upload = conn
                .new_upload(&NewUpload {
                    id: uuid::Uuid::new_v4(),
                    forc_version: TEST_VERSION_1.into(),
                    source_code_ipfs_hash: "test-ipfs-hash".into(),
                    abi_ipfs_hash: None,
                    bytecode_identifier: None,
                    readme: Some(TEST_README.into()),
                    forc_manifest: TEST_MANIFEST.into(),
                })
                .expect("upload is ok");
            Ok::<_, diesel::result::Error>((token, user, upload))
        })
        .unwrap();

    let request = PublishInfo {
        package_name: TEST_PACKAGE_NAME.into(),
        upload_id: upload.id,
        num: Version::parse(TEST_VERSION_1).unwrap(),
        package_description: Some(TEST_DESCRIPTION.into()),
        repository: Url::parse(TEST_URL_REPO).ok(),
        documentation: Url::parse(TEST_URL_DOC).ok(),
        homepage: Url::parse(TEST_URL_HOME).ok(),
        urls: vec![Url::parse(TEST_URL_OTHER).expect("other url")],
        readme: Some(TEST_README.into()),
        license: Some(TEST_LICENSE.into()),
    };

    let version_result = db
        .transaction(|conn| {
            // Insert a package version for a package that doesn't exist
            let version_result = conn
                .new_package_version(&token, &request)
                .expect("version result is ok");
            assert_eq!(
                version_result,
                PackageVersion {
                    id: version_result.id,
                    package_id: version_result.package_id,
                    published_by: user.id,
                    upload_id: upload.id,
                    num: TEST_VERSION_1.into(),
                    package_description: request.package_description,
                    repository: Some(TEST_URL_REPO.into()),
                    documentation: Some(TEST_URL_DOC.into()),
                    homepage: Some(TEST_URL_HOME.into()),
                    urls: vec![Some(TEST_URL_OTHER.into())],
                    license: request.license,
                    created_at: version_result.created_at,
                }
            );

            let pkg_result = conn
                .get_package_by_id(version_result.package_id)
                .expect("pkg result is ok");
            assert_eq!(pkg_result.package_name, TEST_PACKAGE_NAME);
            assert_eq!(pkg_result.user_owner, user.id);
            assert_eq!(pkg_result.default_version, Some(version_result.id));
            Ok::<_, diesel::result::Error>(version_result)
        })
        .unwrap();
    let _ = db.transaction(|conn| {
        // Test get_full_package_version
        let result = conn
            .get_full_package_version(TEST_PACKAGE_NAME.into(), TEST_VERSION_1.into())
            .expect("get_full_package_version result is ok");
        assert_eq!(
            result,
            FullPackage {
                name: TEST_PACKAGE_NAME.into(),
                version: TEST_VERSION_1.into(),
                description: Some(TEST_DESCRIPTION.into()),
                repository: Some(TEST_URL_REPO.into()),
                documentation: Some(TEST_URL_DOC.into()),
                homepage: Some(TEST_URL_HOME.into()),
                urls: vec![Some(TEST_URL_OTHER.into())],
                readme: Some(TEST_README.into()),
                license: Some(TEST_LICENSE.into()),
                created_at: result.created_at,
                updated_at: version_result.created_at,
                bytecode_identifier: upload.bytecode_identifier,
                forc_version: upload.forc_version,
                source_code_ipfs_hash: upload.source_code_ipfs_hash,
                abi_ipfs_hash: upload.abi_ipfs_hash,
            }
        );

        Ok::<(), diesel::result::Error>(())
    });
    let request = PublishInfo {
        package_name: TEST_PACKAGE_NAME.into(),
        upload_id: upload.id,
        num: Version::parse(TEST_VERSION_2).unwrap(),
        package_description: Some("test description 2".into()),
        repository: Url::parse(TEST_URL_REPO).ok(),
        documentation: Url::parse(TEST_URL_DOC).ok(),
        homepage: Url::parse(TEST_URL_HOME).ok(),
        urls: vec![Url::parse(TEST_URL_OTHER).expect("other url")],
        readme: Some("test readme 2".into()),
        license: Some("test licens 2".into()),
    };

    let _ = db.transaction(|conn| {
        // Insert a package version for a package that already exists
        let version_result = conn
            .new_package_version(&token, &request)
            .expect("version result is ok");
        assert_eq!(
            version_result,
            PackageVersion {
                id: version_result.id,
                package_id: version_result.package_id,
                published_by: user.id,
                upload_id: upload.id,
                num: TEST_VERSION_2.into(),
                package_description: request.package_description,
                repository: Some(TEST_URL_REPO.into()),
                documentation: Some(TEST_URL_DOC.into()),
                homepage: Some(TEST_URL_HOME.into()),
                urls: vec![Some(TEST_URL_OTHER.into())],
                license: request.license,
                created_at: version_result.created_at,
            }
        );
        let pkg_result = conn
            .get_package_by_id(version_result.package_id)
            .expect("pkg result is ok");
        assert_eq!(pkg_result.package_name, TEST_PACKAGE_NAME);
        assert_eq!(pkg_result.user_owner, user.id);
        assert_eq!(pkg_result.default_version, Some(version_result.id));
        Ok::<(), diesel::result::Error>(())
    });
    let _ = db.transaction(|conn| {
        // Test get_full_packages page 1
        let result = conn
            .get_full_packages(
                None,
                Pagination {
                    page: Some(1),
                    per_page: Some(1),
                },
            )
            .expect("get_full_packages result is ok");

        assert_eq!(result.current_page, 1);
        assert_eq!(result.per_page, 1);
        assert_eq!(result.total_pages, 2);
        assert_eq!(result.total_count, 2);
        assert_eq!(result.data.len(), 1);
        assert_eq!(result.data[0].version, TEST_VERSION_2); // latest version

        // Test get_full_packages page 2
        let result = conn
            .get_full_packages(
                None,
                Pagination {
                    page: Some(2),
                    per_page: Some(1),
                },
            )
            .expect("get_full_packages result is ok");

        assert_eq!(result.current_page, 2);
        assert_eq!(result.per_page, 1);
        assert_eq!(result.total_pages, 2);
        assert_eq!(result.total_count, 2);
        assert_eq!(result.data.len(), 1);
        assert_eq!(result.data[0].version, TEST_VERSION_1); // latest version

        // Test get_full_packages date filter (should return no results)
        let result = conn
            .get_full_packages(
                Some(Utc::now()),
                Pagination {
                    page: Some(1),
                    per_page: Some(1),
                },
            )
            .expect("get_full_packages result is ok");
        assert_eq!(result.current_page, 1);
        assert_eq!(result.per_page, 1);
        assert_eq!(result.total_pages, 0);
        assert_eq!(result.total_count, 0);
        assert_eq!(result.data.len(), 0);
        Ok::<(), diesel::result::Error>(())
    });
}

#[test]
#[serial]
fn test_package_categories_keywords() {
    let db = &mut setup_db();
    let _ = db.transaction(|conn| {
        // Set up session, user, token, and upload.
        let session = conn
            .new_user_session(&mock_user_1(), 1000)
            .expect("session is ok");
        let user = conn.get_user_for_session(session.id).expect("user is ok");
        let (token, _) = conn
            .new_token(user.id, "test token".to_string())
            .expect("token is ok");
        let upload = conn
            .new_upload(&NewUpload {
                id: uuid::Uuid::new_v4(),
                forc_version: TEST_VERSION_1.into(),
                source_code_ipfs_hash: "test-ipfs-hash".into(),
                abi_ipfs_hash: None,
                bytecode_identifier: None,
                readme: None,
                forc_manifest: TEST_MANIFEST.into(),
            })
            .expect("upload is ok");

        let request = PublishInfo {
            package_name: TEST_PACKAGE_NAME.into(),
            upload_id: upload.id,
            num: Version::parse(TEST_VERSION_3).unwrap(),
            package_description: None,
            repository: None,
            documentation: None,
            homepage: None,
            urls: vec![],
            readme: None,
            license: None,
        };

        let version_result = conn
            .new_package_version(&token, &request)
            .expect("version result is ok");

        // Insert categories
        let categories = vec!["cat1".to_string(), "cat2".to_string()];
        let cat_count = conn
            .insert_categories(version_result.package_id, &categories)
            .expect("insert categories is ok");
        assert_eq!(cat_count, 2);

        // Insert keywords
        let keywords = vec!["key1".to_string(), "key2".to_string()];
        let key_count = conn
            .insert_keywords(version_result.package_id, &keywords)
            .expect("insert keywords is ok");
        assert_eq!(key_count, 2);

        Ok::<(), diesel::result::Error>(())
    });
}

// Tests for ABI inlining functionality
#[tokio::test]
#[serial]
async fn test_abi_inlining_with_mock_pinata() {
    use forc_pub::api::search::FullPackage;
    use forc_pub::file_uploader::pinata::PinataClient;
    use forc_pub::handlers::upload::UploadError;
    use forc_pub::models;
    use std::env;
    use std::path::Path;
    // Create a test mock client that returns mock ABI content
    struct TestMockPinataClient;

    impl PinataClient for TestMockPinataClient {
        async fn new() -> Result<Self, UploadError> {
            Ok(TestMockPinataClient)
        }

        async fn upload_file_to_ipfs(&self, _path: &Path) -> Result<String, UploadError> {
            Ok("test_abi_hash".to_string())
        }

        async fn fetch_ipfs_content(&self, _ipfs_hash: &str) -> Result<Vec<u8>, UploadError> {
            // Return a more realistic ABI structure
            Ok(r#"{"types": [{"id": 1, "type": "u64"}], "functions": [{"name": "test_function", "inputs": [], "outputs": []}]}"#.as_bytes().to_vec())
        }
    }

    // Set up environment variables
    env::set_var("PINATA_URL", "https://test-pinata.com");

    // Create a mock FullPackage from database model (simulating what we'd get from DB)
    let db_full_package = models::FullPackage {
        name: "test-abi-package".to_string(),
        version: "1.0.0".to_string(),
        description: Some("Test package with ABI".to_string()),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        bytecode_identifier: None,
        forc_version: "0.68.0".to_string(),
        source_code_ipfs_hash: "source_hash_123".to_string(),
        abi_ipfs_hash: Some("abi_hash_456".to_string()),
        repository: None,
        documentation: None,
        homepage: None,
        urls: vec![],
        readme: None,
        license: None,
    };

    // Test 1: Convert without ABI inlining (default behavior)
    let full_package_without_abi = FullPackage::from(db_full_package.clone());
    assert!(full_package_without_abi.abi_ipfs_url.is_some());
    assert!(full_package_without_abi.abi.is_none());

    // Test 2: Simulate ABI inlining process
    let mock_client = TestMockPinataClient;
    let mut full_package_with_abi = FullPackage::from(db_full_package.clone());

    // Simulate the inline_abi=true logic from the endpoint
    if let Some(abi_hash) = db_full_package.abi_ipfs_hash {
        match mock_client.fetch_ipfs_content(&abi_hash).await {
            Ok(abi_content) => {
                if let Ok(abi_json) = serde_json::from_slice::<serde_json::Value>(&abi_content) {
                    full_package_with_abi.abi = Some(abi_json);
                }
            }
            Err(_) => {
                // Should not happen in this test
                panic!("Mock client should not fail");
            }
        }
    }

    // Should have both URL and inline content
    assert!(full_package_with_abi.abi_ipfs_url.is_some());
    assert!(full_package_with_abi.abi.is_some());

    // Verify the mock ABI content is correctly fetched and included
    let abi = full_package_with_abi.abi.as_ref().unwrap();
    assert!(abi.get("types").is_some());
    assert!(abi.get("functions").is_some());

    let functions = abi.get("functions").unwrap().as_array().unwrap();
    assert_eq!(functions.len(), 1);
    assert_eq!(
        functions[0].get("name").unwrap().as_str().unwrap(),
        "test_function"
    );

    // Test 3: Verify serialization works correctly
    let json_with_abi = serde_json::to_value(&full_package_with_abi).unwrap();
    assert!(json_with_abi.get("abiIpfsUrl").is_some());
    assert!(json_with_abi.get("abi").is_some());

    let serialized_abi = json_with_abi.get("abi").unwrap();
    assert!(serialized_abi.get("types").is_some());
    assert!(serialized_abi.get("functions").is_some());
}

#[test]
#[serial]
fn test_full_package_abi_field_serialization() {
    use forc_pub::api::search::FullPackage;
    use forc_pub::models::PackagePreview;

    let package_preview_1 = PackagePreview {
        name: "test-package".to_string(),
        version: "0.1.0".to_string(),
        description: Some("Test description".to_string()),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let package_preview_2 = PackagePreview {
        name: "test-package".to_string(),
        version: "0.1.0".to_string(),
        description: Some("Test description".to_string()),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Test without ABI field
    let full_package_without_abi = FullPackage {
        package_preview: package_preview_1,
        bytecode_identifier: None,
        forc_version: "0.68.0".to_string(),
        source_code_ipfs_url: "https://example.com/source".to_string(),
        abi_ipfs_url: Some("https://example.com/abi".to_string()),
        abi: None,
        repository: None,
        documentation: None,
        homepage: None,
        urls: vec![],
        readme: None,
        license: None,
    };

    let json_without_abi = serde_json::to_value(&full_package_without_abi).unwrap();
    assert!(json_without_abi.get("abi").is_none());
    assert!(json_without_abi.get("abiIpfsUrl").is_some());

    // Test with ABI field
    let mock_abi = serde_json::json!({
        "abi": "mock",
        "types": []
    });

    let full_package_with_abi = FullPackage {
        package_preview: package_preview_2,
        bytecode_identifier: None,
        forc_version: "0.68.0".to_string(),
        source_code_ipfs_url: "https://example.com/source".to_string(),
        abi_ipfs_url: Some("https://example.com/abi".to_string()),
        abi: Some(mock_abi.clone()),
        repository: None,
        documentation: None,
        homepage: None,
        urls: vec![],
        readme: None,
        license: None,
    };

    let json_with_abi = serde_json::to_value(&full_package_with_abi).unwrap();
    assert!(json_with_abi.get("abi").is_some());
    assert!(json_with_abi.get("abiIpfsUrl").is_some());
    assert_eq!(json_with_abi.get("abi"), Some(&mock_abi));
}

#[test]
#[serial]
fn test_full_package_conversion_maintains_abi_none() {
    use forc_pub::api::search::FullPackage;
    use forc_pub::models;
    use std::env;

    // Set required environment variable for the test
    env::set_var("PINATA_URL", "https://test-pinata.com");

    let db_full_package = models::FullPackage {
        name: "test".to_string(),
        version: "0.1.0".to_string(),
        description: Some("test".to_string()),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        bytecode_identifier: None,
        forc_version: "0.68.0".to_string(),
        source_code_ipfs_hash: "source123".to_string(),
        abi_ipfs_hash: Some("abi123".to_string()),
        repository: None,
        documentation: None,
        homepage: None,
        urls: vec![],
        readme: None,
        license: None,
    };

    let api_full_package = FullPackage::from(db_full_package);

    // Should have abi_ipfs_url but abi should be None by default
    assert!(api_full_package.abi_ipfs_url.is_some());
    assert!(api_full_package.abi.is_none());
}
