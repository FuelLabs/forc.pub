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
use forc_pub::upload::{handle_project_upload, UploadError};
use rocket::fs::TempFile;
use rocket::http::{Cookie, CookieJar};
use rocket::{serde::json::Json, State};
use std::fs::{self};
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

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
    println!(
        "Publishing: {:?} for token: {:?}",
        request, auth.token.friendly_name
    );

    Ok(Json(EmptyResponse))
}

#[post(
    "/upload_project?<forc_version>",
    format = "application/x-www-form-urlencoded",
    data = "<tarball>"
)]
async fn upload_project(
    db: &State<Database>,
    pinata_client: &State<PinataClientImpl>,
    forc_version: &str,
    mut tarball: TempFile<'_>,
) -> ApiResult<UploadResponse> {
    // Install the forc version if it's not already installed.
    let forc_path_str = format!("forc-{forc_version}");
    let forc_path = PathBuf::from(&forc_path_str);
    fs::create_dir_all(forc_path.clone()).unwrap();
    let forc_path = fs::canonicalize(forc_path.clone()).unwrap();

    let output = Command::new("cargo")
        .arg("binstall")
        .arg("--no-confirm")
        .arg("--root")
        .arg(&forc_path)
        .arg(format!("--pkg-url=https://github.com/FuelLabs/sway/releases/download/{forc_version}/forc-binaries-linux_arm64.tar.gz"))
        .arg("--bin-dir=forc-binaries/forc")
        .arg("--pkg-fmt=tgz")
        .arg("forc")
        .output()
        .expect("Failed to execute cargo install");

    if !output.status.success() {
        return Err(ApiError::Upload(UploadError::InvalidForcVersion(
            forc_version.to_string(),
        )));
    }

    // Create an upload ID and temporary directory.
    let upload_id = Uuid::new_v4();
    let upload_dir_str = format!("tmp/uploads/{}", upload_id);
    let upload_dir = Path::new(&upload_dir_str);

    fs::create_dir_all(upload_dir).unwrap();

    // Persist the file to disk.
    let orig_tarball_path = upload_dir.join("original.tgz");
    tarball
        .persist_to(&orig_tarball_path)
        .await
        .map_err(|_| ApiError::Upload(UploadError::SaveFile))?;

    // Handle the project upload and store the metadata in the database.
    let upload = handle_project_upload(
        upload_dir,
        &upload_id,
        &orig_tarball_path,
        &forc_path,
        forc_version.to_string(),
        pinata_client.inner(),
    )
    .await?;
    let _ = db.conn().insert_upload(&upload)?;

    // Clean up the temp directory.
    fs::remove_dir_all(upload_dir).unwrap();

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
    let pinata_client = PinataClientImpl::new().await.expect("pinata client");

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
