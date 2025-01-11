use diesel::RunQueryDsl as _;
use forc_pub::api;
use forc_pub::db::{Database, DbConn};
use forc_pub::models::{NewUpload, PackageVersion};
use serial_test::serial;

/// Note: Integration tests for the database module assume that the database is running and that the DATABASE_URL environment variable is set.
/// This should be done by running `./scripts/start_local_db.sh` before running the tests.

// Test constants
const TEST_LOGIN_1: &str = "AliceBobbins";
const TEST_FULL_NAME_1: &str = "Alice Bobbins";
const TEST_EMAIL_1: &str = "alice@bob.com";
const TEST_URL_1: &str = "url1.url";
const TEST_URL_2: &str = "url2.url";
const TEST_LOGIN_2: &str = "foobar";
const TEST_TOKEN_NAME_1: &str = "test token 1";
const TEST_TOKEN_NAME_2: &str = "test token 2";

fn clear_tables(db: &mut DbConn) {
    diesel::delete(forc_pub::schema::package_versions::table)
        .execute(db.inner())
        .expect("clear package_versions table");
    diesel::delete(forc_pub::schema::packages::table)
        .execute(db.inner())
        .expect("clear packages table");
    diesel::delete(forc_pub::schema::api_tokens::table)
        .execute(db.inner())
        .expect("clear api_tokens table");
    diesel::delete(forc_pub::schema::sessions::table)
        .execute(db.inner())
        .expect("clear sessions table");
    diesel::delete(forc_pub::schema::users::table)
        .execute(db.inner())
        .expect("clear users table");
}

fn mock_user_1() -> api::auth::User {
    api::auth::User {
        github_login: TEST_LOGIN_1.to_string(),
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
    let db = &mut Database::default().conn();

    let user1 = mock_user_1();
    let user2 = mock_user_2();

    let session1 = db.new_user_session(&user1, 1000).expect("result is ok");

    // Insert an existing user
    let session2 = db.new_user_session(&user1, 1000).expect("result is ok");

    // Insert another user
    let session3 = db.new_user_session(&user2, 1000).expect("result is ok");

    let result = db.get_user_for_session(session1.id).expect("result is ok");
    assert_eq!(result.github_login, TEST_LOGIN_1);
    assert_eq!(result.full_name, TEST_FULL_NAME_1);
    assert_eq!(result.email.expect("is some"), TEST_EMAIL_1);
    assert_eq!(result.avatar_url.expect("is some"), TEST_URL_1);
    assert_eq!(result.github_url, TEST_URL_2);
    assert!(result.is_admin);

    let result = db.get_user_for_session(session2.id).expect("result is ok");
    assert_eq!(result.github_login, TEST_LOGIN_1);

    let result = db.get_user_for_session(session3.id).expect("result is ok");
    assert_eq!(result.github_login, TEST_LOGIN_2);

    clear_tables(db);
}

#[test]
#[serial]
fn test_api_tokens() {
    let db = &mut Database::default().conn();

    let session = db
        .new_user_session(&mock_user_1(), 1000)
        .expect("result is ok");
    let user = db.get_user_for_session(session.id).expect("result is ok");

    // Insert tokens
    let (token1, plain_token1) = db
        .new_token(user.id, TEST_TOKEN_NAME_1.into())
        .expect("result is ok");
    let (token2, plain_token2) = db
        .new_token(user.id, TEST_TOKEN_NAME_2.into())
        .expect("result is ok");

    assert_eq!(token1.friendly_name, TEST_TOKEN_NAME_1);
    assert_eq!(token1.expires_at, None);
    assert_eq!(token2.friendly_name, TEST_TOKEN_NAME_2);
    assert_eq!(token2.expires_at, None);

    // Test token hashing
    assert_eq!(token1, db.get_token(plain_token1).expect("test token 1"));
    assert_eq!(token2, db.get_token(plain_token2).expect("test token 2"));

    // Get tokens
    let tokens = db.get_tokens_for_user(user.id).expect("result is ok");
    assert_eq!(tokens.len(), 2);

    // Delete tokens
    db.delete_token(user.id, token1.id.into())
        .expect("result is ok");
    let tokens = db.get_tokens_for_user(user.id).expect("result is ok");
    assert_eq!(tokens.len(), 1);
    db.delete_token(user.id, token2.id.into())
        .expect("result is ok");
    let tokens = db.get_tokens_for_user(user.id).expect("result is ok");
    assert_eq!(tokens.len(), 0);

    clear_tables(db);
}

#[test]
#[serial]
fn test_package_versions() {
    let db = &mut Database::default().conn();

    // Set up session, user, token, and upload.
    let session = db
        .new_user_session(&mock_user_1(), 1000)
        .expect("result is ok");
    let user = db.get_user_for_session(session.id).expect("user is ok");
    let (token, _) = db
        .new_token(user.id, "test token".to_string())
        .expect("token is ok");
    let upload = db
        .new_upload(&NewUpload {
            id: uuid::Uuid::new_v4(),
            forc_version: "0.1.0".into(),
            source_code_ipfs_hash: "test-ipfs-hash".into(),
            abi_ipfs_hash: None,
            bytecode_identifier: None,
        })
        .expect("result is ok");

    // Insert a package version for a package that doesn't exist
    let request = api::publish::PublishRequest {
        package_name: "test-package".into(),
        upload_id: upload.id,
        num: "0.1.0".into(),
        package_description: Some("test description".into()),
        repository: Some("test repository".into()),
        documentation: Some("test documentation".into()),
        homepage: Some("test homepage".into()),
        urls: vec![Some("test url".into())],
        readme: Some("test readme".into()),
        license: Some("test license".into()),
    };
    let version_result = db
        .new_package_version(&token, &request)
        .expect("version result is ok");
    assert_eq!(
        version_result,
        PackageVersion {
            id: version_result.id,
            package_id: version_result.package_id,
            published_by: user.id,
            upload_id: upload.id,
            num: request.num,
            package_description: request.package_description,
            repository: request.repository,
            documentation: request.documentation,
            homepage: request.homepage,
            urls: request.urls,
            readme: request.readme,
            license: request.license,
            created_at: version_result.created_at,
        }
    );
    let pkg_result = db
        .get_package_by_id(version_result.package_id)
        .expect("result is ok");
    assert_eq!(pkg_result.package_name, request.package_name);
    assert_eq!(pkg_result.user_owner, user.id);
    assert_eq!(pkg_result.default_version, Some(version_result.id));

    // Insert a package version for a package that already exists
    let request = api::publish::PublishRequest {
        package_name: "test-package".into(),
        upload_id: upload.id,
        num: "0.2.0".into(),
        package_description: Some("test description 2".into()),
        repository: Some("test repository 2".into()),
        documentation: Some("test documentation 2".into()),
        homepage: Some("test homepage 2".into()),
        urls: vec![Some("test url 2".into())],
        readme: Some("test readme 2".into()),
        license: Some("test licens 2".into()),
    };

    let version_result = db
        .new_package_version(&token, &request)
        .expect("version result is ok");
    assert_eq!(
        version_result,
        PackageVersion {
            id: version_result.id,
            package_id: version_result.package_id,
            published_by: user.id,
            upload_id: upload.id,
            num: request.num,
            package_description: request.package_description,
            repository: request.repository,
            documentation: request.documentation,
            homepage: request.homepage,
            urls: request.urls,
            readme: request.readme,
            license: request.license,
            created_at: version_result.created_at,
        }
    );
    let pkg_result = db
        .get_package_by_id(version_result.package_id)
        .expect("result is ok");
    assert_eq!(pkg_result.package_name, request.package_name);
    assert_eq!(pkg_result.user_owner, user.id);
    assert_eq!(pkg_result.default_version, Some(version_result.id));

    clear_tables(db);
}
