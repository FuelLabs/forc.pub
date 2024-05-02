use diesel::RunQueryDsl as _;
use forc_pub::api;
use forc_pub::db::{Database, DbConn};
use serial_test::serial;

/// Note: Integration tests for the database module assume that the database is running and that the DATABASE_URL environment variable is set.
/// This should be done by running `./scripts/start_local_db.sh` before running the tests.

const TEST_LOGIN_1: &str = "AliceBobbins";
const TEST_FULL_NAME_1: &str = "Alice Bobbins";
const TEST_EMAIL_1: &str = "alice@bob.com";
const TEST_URL_1: &str = "url1.url";
const TEST_URL_2: &str = "url2.url";
const TEST_LOGIN_2: &str = "foobar";
const TEST_TOKEN_NAME_1: &str = "test token 1";
const TEST_TOKEN_NAME_2: &str = "test token 2";

fn clear_tables(db: &mut DbConn) {
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

    let session1 = db.insert_user_session(&user1, 1000).expect("result is ok");

    // Insert an existing user
    let session2 = db.insert_user_session(&user1, 1000).expect("result is ok");

    // Insert another user
    let session3 = db.insert_user_session(&user2, 1000).expect("result is ok");

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
        .insert_user_session(&mock_user_1(), 1000)
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
