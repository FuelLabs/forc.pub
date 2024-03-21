// We ignore this lint because clippy doesn't like the rocket macro for OPTIONS.
#![allow(clippy::let_unit_value)]
#[macro_use]
extern crate rocket;

mod cors;
mod types;

use cors::Cors;
use rocket::serde::json::Json;
use types::{PublishRequest, PublishResponse};

/// The endpoint to compile a Sway contract.
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
        .attach(Cors)
        .mount("/", routes![publish, all_options, health])
        .register("/", catchers![not_found])
}
