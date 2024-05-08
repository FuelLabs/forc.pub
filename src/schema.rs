// @generated automatically by Diesel CLI.

diesel::table! {
    api_tokens (id) {
        id -> Uuid,
        user_id -> Uuid,
        friendly_name -> Varchar,
        token -> Bytea,
        expires_at -> Nullable<Timestamp>,
        created_at -> Timestamp,
    }
}

diesel::table! {
    sessions (id) {
        id -> Uuid,
        user_id -> Uuid,
        expires_at -> Timestamp,
        created_at -> Timestamp,
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
        created_at -> Timestamp,
    }
}

diesel::joinable!(api_tokens -> users (user_id));
diesel::joinable!(sessions -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(api_tokens, sessions, users,);
