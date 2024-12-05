use diesel::prelude::*;
use std::time::SystemTime;
use uuid::Uuid;

#[derive(Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub id: Uuid,
    pub full_name: String,
    pub github_login: String,
    pub github_url: String,
    pub avatar_url: Option<String>,
    pub email: Option<String>,
    pub is_admin: bool,
    pub created_at: SystemTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::users)]
pub struct NewUser {
    pub full_name: String,
    pub github_login: String,
    pub github_url: String,
    pub avatar_url: Option<String>,
    pub email: Option<String>,
    pub is_admin: bool,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::sessions)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub expires_at: SystemTime,
    pub created_at: SystemTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::sessions)]
pub struct NewSession {
    pub user_id: Uuid,
    pub expires_at: SystemTime,
}

#[derive(Queryable, Selectable, Debug, PartialEq, Eq)]
#[diesel(table_name = crate::schema::api_tokens)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct ApiToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub friendly_name: String,
    pub expires_at: Option<SystemTime>,
    pub created_at: SystemTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::api_tokens)]
pub struct NewApiToken {
    pub user_id: Uuid,
    pub friendly_name: String,
    pub token: Vec<u8>,
    pub expires_at: Option<SystemTime>,
}

#[derive(Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::uploads)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Upload {
    pub id: Uuid,
    pub source_code_ipfs_hash: String,
    pub forc_version: String,
    pub abi_ipfs_hash: Option<String>,
    pub bytecode_identifier: Option<String>,
    pub created_at: SystemTime,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = crate::schema::uploads)]
pub struct NewUpload {
    pub id: Uuid,
    pub source_code_ipfs_hash: String,
    pub forc_version: String,
    pub abi_ipfs_hash: Option<String>,
    pub bytecode_identifier: Option<String>,
}
