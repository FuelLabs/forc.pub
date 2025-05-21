// We ignore this lint because clippy doesn't like the rocket macro for OPTIONS.
#![allow(clippy::let_unit_value)]
#[macro_use]
extern crate rocket;

use chrono::{DateTime, Utc};
use forc_pub::api::api_token::{CreateTokenRequest, CreateTokenResponse, Token, TokensResponse};
use forc_pub::api::pagination::{PaginatedResponse, Pagination};
use forc_pub::api::publish::{PublishRequest, PublishResponse, UploadResponse};
use forc_pub::api::search::{FullPackage, RecentPackagesResponse};
use forc_pub::api::ApiError;
use forc_pub::api::{
    auth::{LoginRequest, LoginResponse, UserResponse},
    ApiResult, EmptyResponse,
};
use forc_pub::db::error::DatabaseError;
use forc_pub::db::Database;
use forc_pub::file_uploader::s3::{S3Client, S3ClientImpl};
use forc_pub::file_uploader::{
    pinata::{PinataClient, PinataClientImpl},
    FileUploader,
};
use forc_pub::github::handle_login;
use forc_pub::handlers::publish::handle_publish;
use forc_pub::handlers::upload::{handle_project_upload, install_forc_at_path, UploadError};
use forc_pub::middleware::cors::Cors;
use forc_pub::middleware::session_auth::{SessionAuth, SESSION_COOKIE_NAME};
use forc_pub::middleware::token_auth::TokenAuth;
use forc_pub::models::{PackagePreview, PackageVersionInfo};
use forc_pub::util::{load_env, validate_or_format_semver};
use rocket::http::Status;
use rocket::tokio::task;
use rocket::tokio::time::{self, Duration};
use rocket::{
    data::Capped,
    fs::TempFile,
    http::{Cookie, CookieJar},
    request::Request,
    response::{
        self,
        stream::{Event, EventStream},
    },
    serde::json::Json,
    State,
};
use std::env;
use std::fs::{self};
use std::path::PathBuf;
use std::str::FromStr;
use tempfile::tempdir;
use tracing::info;
use tracing_subscriber::EnvFilter;
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
    let session = db.transaction(|conn| conn.new_user_session(&user, expires_in))?;
    let session_id = session.id.to_string();
    cookies.add(Cookie::build((SESSION_COOKIE_NAME, session_id.clone())));
    Ok(Json(LoginResponse { user, session_id }))
}

/// The endpoint to log out.
#[post("/logout")]
async fn logout(db: &State<Database>, auth: SessionAuth) -> ApiResult<EmptyResponse> {
    let session_id = auth.session_id;
    let _ = db.transaction(|conn| conn.delete_session(session_id))?;
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
    let (token, plain_token) =
        db.transaction(|conn| conn.new_token(user.id, request.name.clone()))?;
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
    db.transaction(|conn| conn.delete_token(user_id, id.clone()))?;
    Ok(Json(EmptyResponse))
}

#[get("/tokens")]
fn tokens(db: &State<Database>, auth: SessionAuth) -> ApiResult<TokensResponse> {
    let user_id = auth.user.id;
    let tokens = db.transaction(|conn| conn.get_tokens_for_user(user_id))?;
    Ok(Json(TokensResponse {
        tokens: tokens.into_iter().map(|t| t.into()).collect(),
    }))
}

#[post("/publish", data = "<request>")]
async fn publish(
    db: &State<Database>,
    request: Json<PublishRequest>,
    auth: TokenAuth,
) -> ApiResult<PublishResponse> {
    match handle_publish(db, &request, &auth.token).await {
        Ok(info) => Ok(Json(PublishResponse {
            name: info.package_name,
            version: info.num,
        })),
        Err(e) => Err(ApiError::Publish(e)),
    }
}

#[post(
    "/upload_project?<forc_version>",
    format = "application/gzip",
    data = "<tarball>"
)]
async fn upload_project<'a>(
    db: &'a State<Database>,
    pinata_client: &'a State<PinataClientImpl>,
    s3_client: &'a State<S3ClientImpl>,
    forc_version: &'a str,
    mut tarball: Capped<TempFile<'a>>,
) -> EventStream![Event + 'a] {
    EventStream! {

        let mut interval = time::interval(Duration::from_secs(1));
        // Ensure that the tarball was fully uploaded.
        yield Event::data("Uploading sway project");
        if !tarball.is_complete() {
            yield Event::json(&ApiError::Upload(UploadError::TooLarge));
            return;
        }

        // Sanitize the forc version.
        yield Event::data(format!("Validating forc version: {forc_version}"));
        let forc_version = match validate_or_format_semver(forc_version) {
            Some(v) => v,
            None => {
                yield Event::json(&ApiError::Upload(UploadError::InvalidForcVersion(forc_version.into())));
                return;
            }
        };

        // Install the forc version if it's not already installed.
        let forc_path_str = format!("forc-{forc_version}");
        let forc_path = PathBuf::from(&forc_path_str);
        if fs::create_dir_all(forc_path.clone()).is_err() {
            yield Event::json(&ApiError::Upload(UploadError::SaveFile));
            return;
        }
        let forc_path = match fs::canonicalize(forc_path.clone()) {
            Ok(p) => p,
            Err(_) => {
                yield Event::json(&ApiError::Upload(UploadError::SaveFile));
                return;
            }
        };

        // Spawn a task to install forc.
        let forc_path_clone = forc_path.clone();
        let forc_version_clone = forc_version.clone();
        let handle = task::spawn_blocking(move || {
            install_forc_at_path(&forc_version_clone, &forc_path_clone)
        });

        while !handle.is_finished() {
            interval.tick().await;
            yield Event::comment("keep-alive");
        }

        match handle.await {
            Ok(Ok(_)) => {},
            Ok(Err(err)) => {
                yield Event::json(&ApiError::Upload(err));
                return;
            }
            Err(_) => {
                yield Event::json(&ApiError::Upload(UploadError::FailedToCompile));
                return;
            }
        }

        // Create an upload ID and temporary directory.
        yield Event::data("Preparing project for publishing");
        let upload_id = Uuid::new_v4();
        let tmp_dir = match tempdir() {
            Ok(d) => d,
            Err(_) => {
                yield Event::json(&ApiError::Upload(UploadError::CreateTempDir));
                return;
            }
        };
        let upload_dir = tmp_dir.path().join(upload_id.to_string());

        if fs::create_dir(upload_dir.clone()).is_err() {
            yield Event::json(&ApiError::Upload(UploadError::SaveFile));
            return;
        }

        // Persist the file to disk.
        let orig_tarball_path = upload_dir.join(ORIGINAL_TARBALL_NAME);
        if (tarball.persist_to(&orig_tarball_path).await).is_err() {
            yield Event::json(&ApiError::Upload(UploadError::SaveFile));
            return;
        }

        // Handle the project upload and store the metadata in the database.
        yield Event::data("Uploading project to IPFS and S3");
        let file_uploader = FileUploader::new(pinata_client.inner(), s3_client.inner());
        // TODO: Add keep-alives for this future.
        let upload_entry = match handle_project_upload(
            &upload_dir,
            &upload_id,
            &orig_tarball_path,
            &forc_path,
            forc_version.to_string(),
            &file_uploader,
        ).await {
            Ok(entry) => entry,
            Err(e) => {
                yield Event::json(&ApiError::Upload(e));
                return;
            }
        };

        if db.transaction(|conn| conn.new_upload(&upload_entry)).is_err() {
            yield Event::json(&ApiError::Upload(UploadError::SaveFile));
            return;
        }

        // Clean up the temporary directory.
        if tmp_dir.close().is_err() {
            yield Event::json(&ApiError::Upload(UploadError::RemoveTempDir));
            return;
        }

        // Final event: success with upload_id
        yield Event::json(&UploadResponse { upload_id });
    }
}

#[get("/packages?<updated_after>&<pagination..>")]
fn packages(
    db: &State<Database>,
    updated_after: Option<&str>,
    pagination: Pagination,
) -> ApiResult<PaginatedResponse<FullPackage>> {
    let updated_after = updated_after.and_then(|date_str| DateTime::<Utc>::from_str(date_str).ok());
    let db_data =
        db.transaction(|conn| conn.get_full_packages(updated_after, pagination.clone()))?;
    let data = db_data.data.into_iter().map(FullPackage::from).collect();

    Ok(Json(PaginatedResponse {
        data,
        total_count: db_data.total_count,
        total_pages: db_data.total_pages,
        current_page: db_data.current_page,
        per_page: db_data.per_page,
    }))
}

#[get("/package?<name>&<version>")]
fn package(db: &State<Database>, name: String, version: Option<String>) -> ApiResult<FullPackage> {
    let db_data =
        db.transaction(|conn| conn.get_full_package_version(name, version.unwrap_or_default()))?;

    Ok(Json(FullPackage::from(db_data)))
}

/// Get all versions for a package.
#[get("/package/versions?<name>")]
fn package_versions(db: &State<Database>, name: String) -> ApiResult<Vec<PackageVersionInfo>> {
    let versions = db.transaction(|conn| conn.get_package_versions(name))?;
    Ok(Json(versions))
}

#[get("/recent_packages")]
fn recent_packages(db: &State<Database>) -> ApiResult<RecentPackagesResponse> {
    let (recently_created, recently_updated) = db.transaction(|conn| {
        let recently_created = conn.get_recently_created()?;
        let recently_updated = conn.get_recently_updated()?;
        Ok::<_, DatabaseError>((recently_created, recently_updated))
    })?;
    Ok(Json(RecentPackagesResponse {
        recently_created,
        recently_updated,
    }))
}

/// Catches all OPTION requests in order to get the CORS related Fairing triggered.
#[options("/<_..>")]
fn all_options() {
    // Intentionally left empty
}

/// Catch all errors and log them before returning a custom error message.
#[catch(default)]
fn default_catcher(status: Status, _req: &Request<'_>) -> response::status::Custom<ApiError> {
    tracing::error!(
        "Error occurred: {} - {:?}",
        status.code,
        status.reason_lossy()
    );
    response::status::Custom(
        status,
        ApiError::Generic(
            format!("{} - {}", status.code, status.reason_lossy()),
            status,
        ),
    )
}

// Indicates the service is running
#[get("/search?<query>&<pagination..>")]
fn search(
    db: &State<Database>,
    query: String,
    pagination: Pagination,
) -> ApiResult<PaginatedResponse<PackagePreview>> {
    let result = db.transaction(|conn| conn.search_packages(query, pagination))?;
    Ok(Json(result))
}

#[get("/health")]
fn health() -> String {
    "true".to_string()
}

// Launch the rocket server.
#[launch]
async fn rocket() -> _ {
    setup_tracing_subscriber();

    let s3_client = S3ClientImpl::new().await.expect("s3 client");

    let pinata_client = PinataClientImpl::new().await.expect("pinata client");

    info!("Starting forc.pub server");

    rocket::build()
        .manage(Database::default())
        .manage(pinata_client)
        .manage(s3_client)
        .attach(Cors)
        .mount(
            "/",
            routes![
                login,
                logout,
                user,
                new_token,
                delete_token,
                tokens,
                publish,
                upload_project,
                packages,
                package,
                package_versions,
                recent_packages,
                search,
                all_options,
                health
            ],
        )
        .register("/", catchers![default_catcher])
}

fn setup_tracing_subscriber() {
    load_env();
    let default_filter = "info"; // Default log level if RUST_LOG is not set
    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(default_filter));
    // Initialize the tracing subscriber with JSON format and no ANSI colors for non-local.
    // For local, use standard formatting. Both respect RUST_LOG.
    if env::var("RUN_ENV").unwrap_or_default() == "local" {
        tracing_subscriber::fmt().with_env_filter(env_filter).init();
    } else {
        tracing_subscriber::fmt()
            .json()
            .with_ansi(false) // ANSI colors are not suitable for JSON logs
            .with_env_filter(env_filter)
            .init();
    }
}
