// We ignore this lint because clippy doesn't like the rocket macro for OPTIONS.
#![allow(clippy::let_unit_value)]
#[macro_use]
extern crate rocket;

use std::hash::Hash;

use forc_pub::api::api_token::{CreateTokenRequest, CreateTokenResponse, DeleteTokenRequest, DeleteTokenResponse, TokensResponse, Token};
use forc_pub::api::auth::LogoutResponse;
use forc_pub::api::{
    auth::{LoginRequest, LoginResponse, UserResponse, User, UserSessionId},
    ApiError, PublishRequest, PublishResponse,
};
use forc_pub::cors::Cors;
use forc_pub::db::Database;
use forc_pub::github::handle_login;
use rocket::http::{Cookie, CookieJar};
use rocket::{serde::json::Json, State};
use uuid::Uuid;

#[derive(Default)]
struct ServerState {
    pub db: Database,
}

impl ServerState {
    pub fn get_authenticated_session(&self, cookies: &CookieJar) -> Result<UserSessionId, ApiError> {
        match cookies.get("session").map(|c| c.value()) {
            Some(session_id) => {
                let user = self
                    .db
                    .get_user_for_session(session_id.to_string())
                    .map_err(|_| ApiError::Unauthorized)?;
                Ok(UserSessionId { user_id : user.id, session_id: session_id.to_string()})
            }
            None => Err(ApiError::MissingCookie),
        }
    }
}

/// The endpoint to authenticate with GitHub.
#[post("/login", data = "<request>")]
async fn login(
    state: &State<ServerState>,
    cookies: &CookieJar<'_>,
    request: Json<LoginRequest>,
) -> Json<LoginResponse> {
    match handle_login(request.code.clone()).await {
        Ok((user, expires_in)) => match state.db.insert_user_session(&user, expires_in) {
            Ok(session_id) => {
                cookies.add(Cookie::build("session", session_id.clone()).expires(None).finish());

                Json(LoginResponse {
                    user: Some(user),
                    session_id: Some(session_id),
                    error: None,
                })
            }
            Err(e) => Json(LoginResponse {
                user: None,
                session_id: None,
                error: Some(e.to_string()),
            }),
        },
        Err(e) => Json(LoginResponse {
            user: None,
            session_id: None,
            error: Some(e.to_string()),
        }),
    }
}

/// The endpoint to log out.
#[post("/logout")]
async fn logout(
    state: &State<ServerState>,
    cookies: &CookieJar<'_>,
) -> Json<LogoutResponse> {

    match state.get_authenticated_session(cookies) {
        Ok(UserSessionId { session_id, ..}) => {
            match state.db.delete_session(session_id.to_string()) {
                Ok(_) => {
                    cookies.remove(Cookie::named("session"));
                    Json(LogoutResponse { error: None })
                }
                Err(e) => Json(LogoutResponse {
                    error: Some(e.to_string()),
                }),
            }
        }
        Err(_) => Json(LogoutResponse {
            error: None
        }),
    }


}

/// The endpoint to authenticate with GitHub.
#[get("/user")]
async fn user(
    state: &State<ServerState>,
    cookies: &CookieJar<'_>,
) -> Json<UserResponse> {
    // cookies.add(Cookie::build("session", id.clone()).expires(None).finish());

    // match state.db.get_user_for_session(id) {
    //     Ok(user) => Json(SessionResponse {
    //         user: Some(User::from(user)),
    //         error: None,
    //     }),

    //     Err(error) => Json(SessionResponse {
    //         user: None,
    //         error: Some(error.to_string()),
    //     }),
    // }

    match state.get_authenticated_session(cookies) { 
        Ok(UserSessionId {user_id, ..}) => match state.db.get_user(user_id) {
            Ok(user) => Json(UserResponse {
                user: Some(User::from(user)),
                error: None,
            }),

            Err(error) => Json(UserResponse {
                user: None,
                error: Some(error.to_string()),
            }),
        },

        Err(error) => Json(UserResponse {
            user: None,
            error: Some(error.to_string()),
        }),
    
    }
}

#[post("/new_token", data = "<request>")]
fn new_token(
    state: &State<ServerState>,
    cookies: &CookieJar<'_>,
    request: Json<CreateTokenRequest>,
) -> Json<CreateTokenResponse> {
    match state.get_authenticated_session(cookies) {
        Ok(UserSessionId { user_id, ..}) => match state.db.new_token(user_id, request.name.clone()) {
            Ok((token, plain_token)) => Json(CreateTokenResponse {
                token: Some(Token {
                    // The only time we return the plain token is when it's created.
                    token: Some(plain_token),
                    ..token.into()
                }
                ),
                error: None,
            }),
            Err(e) => Json(CreateTokenResponse {
                token: None,
                error: Some(e.to_string()),
            }),
        },

        Err(e) => Json(CreateTokenResponse {
            token: None,
            error: Some(e.to_string()),
        }),
    }
}

#[delete("/token/<id>")]
fn delete_token(
    state: &State<ServerState>,
    cookies: &CookieJar<'_>,
    id: String,
) -> Json<DeleteTokenResponse> {
    match state.get_authenticated_session(cookies) {
        Ok(UserSessionId { user_id, ..}) => match state.db.delete_token(user_id, id.clone()) {
            Ok(_) => Json(DeleteTokenResponse {
                error: None,
            }),
            Err(e) => Json(DeleteTokenResponse {
                error: Some(e.to_string()),
            }),
        },

        Err(e) => Json(DeleteTokenResponse {
            error: Some(e.to_string()),
        }),
    }
}

#[get("/tokens")]
fn tokens(state: &State<ServerState>, cookies: &CookieJar<'_>) -> Json<TokensResponse> {
    match state.get_authenticated_session(cookies) {
        Ok(UserSessionId { user_id, ..}) => match state.db.get_tokens_for_user(user_id) {
            Ok(tokens) => Json(TokensResponse {
                tokens: tokens.into_iter().map(|t| t.into()).collect(),
                error: None,
            }),
            Err(e) => Json(TokensResponse {
                tokens: vec![],
                error: Some(e.to_string()),
            }),
        },

        Err(e) => Json(TokensResponse {
            tokens: vec![],
            error: Some(e.to_string()),
        }),
    }
}

/// The endpoint to publish a package version.
#[post("/publish", data = "<request>")]
fn publish(request: Json<PublishRequest>) -> Json<PublishResponse> {
    eprintln!("Received request: {:?}", request);
    Json(PublishResponse { error: None })
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
        .manage(ServerState::default())
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
                all_options,
                health
            ],
        )
        .register("/", catchers![not_found])
}
