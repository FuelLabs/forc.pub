use diesel::RunQueryDsl as _;
use forc_pub::api;
use forc_pub::db::Database;

/// Note: Integration tests for the database module assume that the database is running and that the DATABASE_URL environment variable is set.
/// This should be done by running `./scripts/start_local_db.sh` before running the tests.

const TEST_LOGIN_1: &str = "AliceBobbins";
const TEST_FULL_NAME_1: &str = "Alice Bobbins";
const TEST_EMAIL_1: &str = "alice@bob.com";
const TEST_URL_1: &str = "url1.url";
const TEST_URL_2: &str = "url2.url";
const TEST_LOGIN_2: &str = "foobar";

fn clear_tables(db: &Database) {
    let connection = &mut db.connection();
    diesel::delete(forc_pub::schema::sessions::table)
        .execute(connection)
        .expect("clear sessions table");
    diesel::delete(forc_pub::schema::users::table)
        .execute(connection)
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

#[test]
fn test_multiple_user_sessions() {
    let db = Database::default();

    let user1 = mock_user_1();
    let user2 = mock_user_2();

    let session1 = db.insert_user_session(&user1, 1000).expect("result is ok");

    // Insert an existing user
    let session2 = db.insert_user_session(&user1, 1000).expect("result is ok");

    // Insert another user
    let session3 = db.insert_user_session(&user2, 1000).expect("result is ok");

    let result = db
        .get_user_for_session(session1.id.to_string())
        .expect("result is ok");
    assert_eq!(result.github_login, TEST_LOGIN_1);
    assert_eq!(result.full_name, TEST_FULL_NAME_1);
    assert_eq!(result.email.expect("is some"), TEST_EMAIL_1);
    assert_eq!(result.avatar_url.expect("is some"), TEST_URL_1);
    assert_eq!(result.github_url, TEST_URL_2);
    assert!(result.is_admin);

    let result = db
        .get_user_for_session(session2.id.to_string())
        .expect("result is ok");
    assert_eq!(result.github_login, TEST_LOGIN_1);

    let result = db
        .get_user_for_session(session3.id.to_string())
        .expect("result is ok");
    assert_eq!(result.github_login, TEST_LOGIN_2);

    clear_tables(&db);
}
