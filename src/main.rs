// We ignore this lint because clippy doesn't like the rocket macro for OPTIONS.
#![allow(clippy::let_unit_value)]
#[macro_use]
extern crate rocket;

use forc_pub::api::api_token::{CreateTokenRequest, CreateTokenResponse, Token, TokensResponse};
use forc_pub::api::{
    auth::{LoginRequest, LoginResponse, UserResponse},
    ApiResult, EmptyResponse,
};
use forc_pub::cors::Cors;

use forc_pub::db::Database;
use forc_pub::github::handle_login;
use forc_pub::middleware::session_auth::{SessionAuth, SESSION_COOKIE_NAME};

use rocket::http::{Cookie, CookieJar};

use rocket::{serde::json::Json, State};

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
            token: Some(plain_token),
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
fn rocket() -> _ {
    rocket::build()
        .manage(Database::default())
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
                all_options,
                health
            ],
        )
        .register("/", catchers![not_found])
}
