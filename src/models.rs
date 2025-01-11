use diesel::prelude::*;
use diesel::sql_types::{Nullable, Text, Timestamptz};
use diesel::QueryableByName;
use serde::Serialize;
use std::time::SystemTime;
use time::PrimitiveDateTime;
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

#[derive(Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::packages)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Package {
    pub id: Uuid,
    pub user_owner: Uuid,
    pub package_name: String,
    pub default_version: Option<Uuid>,
    pub created_at: PrimitiveDateTime,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = crate::schema::packages)]
pub struct NewPackage {
    pub user_owner: Uuid,
    pub package_name: String,
}

#[derive(Queryable, Selectable, Debug, Clone, Eq, PartialEq)]
#[diesel(table_name = crate::schema::package_versions)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct PackageVersion {
    pub id: Uuid,
    pub package_id: Uuid,
    pub published_by: Uuid,
    pub upload_id: Uuid,
    pub num: String,
    pub package_description: Option<String>,
    pub repository: Option<String>,
    pub documentation: Option<String>,
    pub homepage: Option<String>,
    pub urls: Vec<Option<String>>,
    pub readme: Option<String>,
    pub license: Option<String>,
    pub created_at: PrimitiveDateTime,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = crate::schema::package_versions)]
pub struct NewPackageVersion {
    pub package_id: Uuid,
    pub publish_token: Uuid,
    pub published_by: Uuid,
    pub upload_id: Uuid,
    pub num: String,
    pub package_description: Option<String>,
    pub repository: Option<String>,
    pub documentation: Option<String>,
    pub homepage: Option<String>,
    pub urls: Vec<Option<String>>,
    pub readme: Option<String>,
    pub license: Option<String>,
}

#[derive(QueryableByName, Serialize, Debug)]
pub struct RecentPackage {
    #[sql_type = "Text"]
    pub name: String, // Corresponds to `p.package_name as name`
    #[sql_type = "Text"]
    pub version: String, // Corresponds to `pv.num as version`
    #[sql_type = "Nullable<Text>"]
    pub description: Option<String>, // Corresponds to `pv.package_description as description`, which might be nullable
    #[sql_type = "Timestamptz"]
    pub created_at: PrimitiveDateTime, // Corresponds to `p.created_at as created_at`
    #[sql_type = "Timestamptz"]
    pub updated_at: PrimitiveDateTime, // Corresponds to `pv.created_at as updated_at`
}
