// We ignore this lint because clippy doesn't like the rocket macro for OPTIONS.
#![allow(clippy::let_unit_value)]
#[macro_use]
extern crate rocket;

use forc_pub::api::api_token::{CreateTokenRequest, CreateTokenResponse, Token, TokensResponse};
use forc_pub::api::publish::{PublishRequest, UploadResponse};
use forc_pub::api::ApiError;
use forc_pub::api::{
    auth::{LoginRequest, LoginResponse, UserResponse},
    ApiResult, EmptyResponse,
};
use forc_pub::db::Database;
use forc_pub::github::handle_login;
use forc_pub::middleware::cors::Cors;
use forc_pub::middleware::session_auth::{SessionAuth, SESSION_COOKIE_NAME};
use forc_pub::middleware::token_auth::TokenAuth;
use forc_pub::pinata::{PinataClient, PinataClientImpl};
use forc_pub::upload::{handle_project_upload, install_forc_at_path, UploadError};
use forc_pub::util::validate_or_format_semver;
use rocket::{
    data::Capped,
    fs::TempFile,
    http::{Cookie, CookieJar},
    serde::json::Json,
    State,
};
use std::fs::{self};
use std::path::PathBuf;
use tempfile::tempdir;
use tracing::info;
use tracing::level_filters::LevelFilter;
use uuid::Uuid;

const ORIGINAL_TARBALL_NAME: &str = "original.tgz";

#[derive(Default)]
pub struct ServerState {
    pub db: Database,
}

/// The endpoint to authenticate with GitHub.
#[post("/login", data = "<request>")]
async fn login(
    db: &State<Database>,
    cookies: &CookieJar<'_>,
    request: Json<LoginRequest>,
) -> ApiResult<LoginResponse> {
    let (user, expires_in) = handle_login(request.code.clone()).await?;
    let session = db.conn().insert_user_session(&user, expires_in)?;
    let session_id = session.id.to_string();
    cookies.add(Cookie::build(SESSION_COOKIE_NAME, session_id.clone()).finish());
    Ok(Json(LoginResponse { user, session_id }))
}

/// The endpoint to log out.
#[post("/logout")]
async fn logout(db: &State<Database>, auth: SessionAuth) -> ApiResult<EmptyResponse> {
    let session_id = auth.session_id;
    let _ = db.conn().delete_session(session_id)?;
    Ok(Json(EmptyResponse))
}

/// The endpoint to authenticate with GitHub.
#[get("/user")]
fn user(auth: SessionAuth) -> Json<UserResponse> {
    Json(UserResponse {
        user: auth.user.into(),
    })
}

#[post("/new_token", data = "<request>")]
fn new_token(
    db: &State<Database>,
    auth: SessionAuth,
    request: Json<CreateTokenRequest>,
) -> ApiResult<CreateTokenResponse> {
    let user = auth.user;
    let (token, plain_token) = db.conn().new_token(user.id, request.name.clone())?;
    Ok(Json(CreateTokenResponse {
        token: Token {
            // The only time we return the plain token is when it's created.
            token: Some(plain_token.into()),
            ..token.into()
        },
    }))
}

#[delete("/token/<id>")]
fn delete_token(db: &State<Database>, auth: SessionAuth, id: String) -> ApiResult<EmptyResponse> {
    let user_id = auth.user.id;
    let _ = db.conn().delete_token(user_id, id.clone())?;
    Ok(Json(EmptyResponse))
}

#[get("/tokens")]
fn tokens(db: &State<Database>, auth: SessionAuth) -> ApiResult<TokensResponse> {
    let user_id = auth.user.id;
    let tokens = db.conn().get_tokens_for_user(user_id)?;
    Ok(Json(TokensResponse {
        tokens: tokens.into_iter().map(|t| t.into()).collect(),
    }))
}

#[post("/publish", data = "<request>")]
fn publish(request: Json<PublishRequest>, auth: TokenAuth) -> ApiResult<EmptyResponse> {
    info!(
        "Publishing: {:?} for token: {:?}",
        request, auth.token.friendly_name
    );

    Ok(Json(EmptyResponse))
}

#[post(
    "/upload_project?<forc_version>",
    format = "application/gzip",
    data = "<tarball>"
)]
async fn upload_project(
    db: &State<Database>,
    pinata_client: &State<PinataClientImpl>,
    forc_version: &str,
    mut tarball: Capped<TempFile<'_>>,
) -> ApiResult<UploadResponse> {
    // Ensure that the tarball was fully uploaded.
    if !tarball.is_complete() {
        return Err(ApiError::Upload(UploadError::TooLarge));
    }

    // Sanitize the forc version.
    let forc_version = validate_or_format_semver(forc_version)
        .ok_or_else(|| ApiError::Upload(UploadError::InvalidForcVersion(forc_version.into())))?;

    // Install the forc version if it's not already installed.
    let forc_path_str = format!("forc-{forc_version}");
    let forc_path = PathBuf::from(&forc_path_str);
    fs::create_dir_all(forc_path.clone()).map_err(|_| ApiError::Upload(UploadError::SaveFile))?;
    let forc_path =
        fs::canonicalize(forc_path.clone()).map_err(|_| ApiError::Upload(UploadError::SaveFile))?;

    install_forc_at_path(&forc_version, &forc_path)?;

    // Create an upload ID and temporary directory.
    let upload_id = Uuid::new_v4();
    let tmp_dir = tempdir().map_err(|_| ApiError::Upload(UploadError::CreateTempDir))?;
    let upload_dir = tmp_dir.path().join(upload_id.to_string());

    fs::create_dir(upload_dir.clone()).map_err(|_| ApiError::Upload(UploadError::SaveFile))?;

    // Persist the file to disk.
    let orig_tarball_path = upload_dir.join(ORIGINAL_TARBALL_NAME);
    tarball
        .persist_to(&orig_tarball_path)
        .await
        .map_err(|_| ApiError::Upload(UploadError::SaveFile))?;

    // Handle the project upload and store the metadata in the database.
    let upload_entry = handle_project_upload(
        &upload_dir,
        &upload_id,
        &orig_tarball_path,
        &forc_path,
        forc_version.to_string(),
        pinata_client.inner(),
    )
    .await?;

    let _ = db.conn().insert_upload(&upload_entry)?;

    // Clean up the temporary directory.
    tmp_dir
        .close()
        .map_err(|_| ApiError::Upload(UploadError::RemoveTempDir))?;

    Ok(Json(UploadResponse { upload_id }))
}

/// Catches all OPTION requests in order to get the CORS related Fairing triggered.
#[options("/<_..>")]
fn all_options() {
    // Intentionally left empty
}

/// Catch 404 not founds.
#[catch(404)]
fn not_found() -> String {
    "Not found".to_string()
}

// Indicates the service is running
#[get("/health")]
fn health() -> String {
    "true".to_string()
}

// Launch the rocket server.
#[launch]
async fn rocket() -> _ {
    tracing_subscriber::fmt()
        .with_max_level(LevelFilter::INFO)
        .init();

    let pinata_client = PinataClientImpl::new().await.expect("pinata client");

    info!("Starting forc.pub server");

    rocket::build()
        .manage(Database::default())
        .manage(pinata_client)
        .attach(Cors)
        .mount(
            "/",
            routes![
                login,
                logout,
                user,
                new_token,
                delete_token,
                publish,
                upload_project,
                tokens,
                all_options,
                health
            ],
        )
        .register("/", catchers![not_found])
}
