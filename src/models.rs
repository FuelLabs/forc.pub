use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::BigInt;
use diesel::sql_types::{Array, Nullable, Text, Timestamptz};
use diesel::QueryableByName;
use serde::Serialize;
use uuid::Uuid;

#[derive(Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub id: Uuid,
    pub github_id: String,
    pub full_name: String,
    pub github_login: String,
    pub github_url: String,
    pub avatar_url: Option<String>,
    pub email: Option<String>,
    pub is_admin: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::users)]
pub struct NewUser {
    pub full_name: String,
    pub github_id: String,
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
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::sessions)]
pub struct NewSession {
    pub user_id: Uuid,
    pub expires_at: DateTime<Utc>,
}

#[derive(Queryable, Selectable, Debug, PartialEq, Eq)]
#[diesel(table_name = crate::schema::api_tokens)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct ApiToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub friendly_name: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::api_tokens)]
pub struct NewApiToken {
    pub user_id: Uuid,
    pub friendly_name: String,
    pub token: Vec<u8>,
    pub expires_at: Option<DateTime<Utc>>,
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
    pub readme: Option<String>,
    pub forc_manifest: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = crate::schema::uploads)]
pub struct NewUpload {
    pub id: Uuid,
    pub source_code_ipfs_hash: String,
    pub forc_version: String,
    pub abi_ipfs_hash: Option<String>,
    pub bytecode_identifier: Option<String>,
    pub readme: Option<String>,
    pub forc_manifest: String,
}

#[derive(Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::package_dependencies)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct PackageDep {
    pub id: Uuid,
    pub dependent_package_version_id: Uuid,
    pub dependency_package_name: String,
    pub dependency_version_req: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = crate::schema::package_dependencies)]
pub struct NewPackageDep {
    pub dependent_package_version_id: Uuid,
    pub dependency_package_name: String,
    pub dependency_version_req: String,
}

#[derive(Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::packages)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Package {
    pub id: Uuid,
    pub user_owner: Uuid,
    pub package_name: String,
    pub default_version: Option<Uuid>,
    pub created_at: DateTime<Utc>,
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
    pub license: Option<String>,
    pub created_at: DateTime<Utc>,
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
    pub license: Option<String>,
}

#[derive(Queryable, Selectable, Debug, Clone, Eq, PartialEq)]
#[diesel(table_name = crate::schema::package_categories)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct PackageCategory {
    pub id: Uuid,
    pub package_id: Uuid,
    pub category: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = crate::schema::package_categories)]
pub struct NewPackageCategory {
    pub package_id: Uuid,
    pub category: String,
}

#[derive(Queryable, Selectable, Debug, Clone, Eq, PartialEq)]
#[diesel(table_name = crate::schema::package_keywords)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct PackageKeyword {
    pub id: Uuid,
    pub package_id: Uuid,
    pub keyword: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = crate::schema::package_keywords)]
pub struct NewPackageKeyword {
    pub package_id: Uuid,
    pub keyword: String,
}

#[derive(QueryableByName, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackagePreview {
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Text)]
    pub version: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub description: Option<String>,
    #[diesel(sql_type = Timestamptz)]
    pub created_at: DateTime<Utc>,
    #[diesel(sql_type = Timestamptz)]
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackagePreviewWithCategories {
    #[serde(flatten)]
    pub package: PackagePreview,
    pub categories: Vec<String>,
    pub keywords: Vec<String>,
}

#[derive(QueryableByName, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FullPackage {
    // Everything from PackagePreview
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Text)]
    pub version: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub description: Option<String>,
    #[diesel(sql_type = Timestamptz)]
    pub created_at: DateTime<Utc>,
    #[diesel(sql_type = Timestamptz)]
    pub updated_at: DateTime<Utc>,

    // Metadata from Uploads table
    #[diesel(sql_type = Nullable<Text>)]
    pub bytecode_identifier: Option<String>,
    #[diesel(sql_type = Text)]
    pub forc_version: String,

    // IPFS hashes
    #[diesel(sql_type = Text)]
    pub source_code_ipfs_hash: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub abi_ipfs_hash: Option<String>,

    // Version Metadata
    #[diesel(sql_type = Nullable<Text>)]
    pub repository: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub documentation: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub homepage: Option<String>,
    #[diesel(sql_type = Array<Nullable<Text>>)]
    pub urls: Vec<Option<String>>,
    #[diesel(sql_type = Nullable<Text>)]
    pub readme: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub license: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FullPackageWithCategories {
    #[serde(flatten)]
    pub package: FullPackage,
    pub categories: Vec<String>,
    pub keywords: Vec<String>,
}

#[derive(QueryableByName)]
pub struct CountResult {
    #[diesel(sql_type = BigInt)]
    pub count: i64,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AuthorInfo {
    pub full_name: String,
    pub github_login: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PackageVersionInfo {
    pub version: String,
    pub author: AuthorInfo,
    pub license: Option<String>,
    pub created_at: DateTime<Utc>,
}
