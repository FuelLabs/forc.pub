// We ignore this lint because clippy doesn't like the rocket macro for OPTIONS.
#![allow(clippy::let_unit_value)]
#[macro_use]
extern crate rocket;

use forc_pub::api::{
    LoginRequest, LoginResponse, PublishRequest, PublishResponse, SessionResponse, User,
};
use forc_pub::cors::Cors;
use forc_pub::db::Database;
use forc_pub::github::handle_login;
use rocket::{serde::json::Json, State};

#[derive(Default)]
struct ServerState {
    pub db: Database,
}

/// The endpoint to authenticate with GitHub.
#[post("/login", data = "<request>")]
async fn login(state: &State<ServerState>, request: Json<LoginRequest>) -> Json<LoginResponse> {
    match handle_login(request.code.clone()).await {
        Ok((user, expires_in)) => match state.db.insert_user_session(&user, expires_in) {
            Ok(session_id) => Json(LoginResponse {
                user: Some(user),
                session_id: Some(session_id),
                error: None,
            }),
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

/// The endpoint to authenticate with GitHub.
#[get("/session?<id>")]
async fn session(state: &State<ServerState>, id: String) -> Json<SessionResponse> {
    match state.db.get_user_for_session(id) {
        Ok(user) => Json(SessionResponse {
            user: Some(User::from(user)),
            error: None,
        }),
        Err(error) => Json(SessionResponse {
            user: None,
            error: Some(error.to_string()),
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
        .mount("/", routes![login, session, publish, all_options, health])
        .register("/", catchers![not_found])
}
