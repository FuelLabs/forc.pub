// We ignore this lint because clippy doesn't like the rocket macro for OPTIONS.
#![allow(clippy::let_unit_value)]
#[macro_use]
extern crate rocket;

mod api;
mod cors;
mod github;

use crate::github::handle_login;
use api::{LoginRequest, LoginResponse, PublishRequest, PublishResponse, SessionResponse, User};
use cors::Cors;
use rocket::{serde::json::Json, State};
use std::{collections::HashMap, sync::Mutex};

#[derive(Default)]
struct ServerState {
    // TODO: Set up SQL database and use sessions table.
    sessions: Mutex<HashMap<String, User>>,
}

impl ServerState {
    pub fn new() -> Self {
        ServerState {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn insert(&self, user: &User) -> String {
        let session_id = nanoid::nanoid!();
        self.sessions
            .lock()
            .expect("lock sessions")
            .insert(session_id.clone(), user.clone());
        session_id
    }
}

/// The endpoint to authenticate with GitHub.
#[post("/login", data = "<request>")]
async fn login(state: &State<ServerState>, request: Json<LoginRequest>) -> Json<LoginResponse> {
    match handle_login(request.code.clone()).await {
        Ok(user) => {
            let session_id = state.insert(&user);
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
    }
}

/// The endpoint to authenticate with GitHub.
#[get("/session?<id>")]
async fn session(state: &State<ServerState>, id: String) -> Json<SessionResponse> {
    let sessions = state.sessions.lock().expect("lock sessions");
    match sessions.get(&id) {
        Some(user) => Json(SessionResponse {
            user: Some(user.clone()),
            error: None,
        }),
        None => Json(SessionResponse {
            user: None,
            error: Some("Invalid session".to_string()),
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
        .manage(ServerState::new())
        .attach(Cors)
        .mount("/", routes![login, session, publish, all_options, health])
        .register("/", catchers![not_found])
}
