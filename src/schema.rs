// @generated automatically by Diesel CLI.

diesel::table! {
    api_tokens (id) {
        id -> Uuid,
        user_id -> Uuid,
        friendly_name -> Varchar,
        token -> Bytea,
        expires_at -> Nullable<Timestamptz>,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    package_dependencies (id) {
        id -> Uuid,
        dependent_package_version_id -> Uuid,
        dependency_package_name -> Varchar,
        dependency_version_req -> Varchar,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    package_versions (id) {
        id -> Uuid,
        package_id -> Uuid,
        publish_token -> Uuid,
        published_by -> Uuid,
        upload_id -> Uuid,
        num -> Varchar,
        package_description -> Nullable<Varchar>,
        repository -> Nullable<Varchar>,
        documentation -> Nullable<Varchar>,
        homepage -> Nullable<Varchar>,
        urls -> Array<Nullable<Text>>,
        license -> Nullable<Varchar>,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    packages (id) {
        id -> Uuid,
        user_owner -> Uuid,
        package_name -> Varchar,
        default_version -> Nullable<Uuid>,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    sessions (id) {
        id -> Uuid,
        user_id -> Uuid,
        expires_at -> Timestamptz,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    uploads (id) {
        id -> Uuid,
        source_code_ipfs_hash -> Varchar,
        forc_version -> Varchar,
        abi_ipfs_hash -> Nullable<Varchar>,
        bytecode_identifier -> Nullable<Varchar>,
        created_at -> Timestamptz,
        readme -> Varchar,
        forc_manifest -> Nullable<Varchar>,
    }
}

diesel::table! {
    users (id) {
        id -> Uuid,
        full_name -> Varchar,
        github_login -> Varchar,
        github_url -> Varchar,
        avatar_url -> Nullable<Varchar>,
        email -> Nullable<Varchar>,
        is_admin -> Bool,
        created_at -> Timestamptz,
    }
}

diesel::joinable!(api_tokens -> users (user_id));
diesel::joinable!(package_dependencies -> package_versions (dependent_package_version_id));
diesel::joinable!(package_versions -> api_tokens (publish_token));
diesel::joinable!(package_versions -> uploads (upload_id));
diesel::joinable!(package_versions -> users (published_by));
diesel::joinable!(packages -> users (user_owner));
diesel::joinable!(sessions -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    api_tokens,
    package_dependencies,
    package_versions,
    packages,
    sessions,
    uploads,
    users,
);
