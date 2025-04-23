//! Note: Integration tests for the database module assume that the database is running and that the DATABASE_URL environment variable is set.
//! This should be done by running `./scripts/start_local_db.sh` before running the tests.

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
