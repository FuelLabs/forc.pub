use std::env;

use dotenvy::dotenv;
use regex::Regex;
use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::{Header, HeaderMap};
use rocket::{Request, Response};

// Build an open cors module so this server can be used accross many locations on the web.
pub struct Cors;

fn get_allowed_origin(headers: &HeaderMap<'_>) -> Option<String> {
    dotenv().ok();

    if let Some(req_origin) = headers.get_one("Origin") {
        // If the environment variable CORS_HTTP_ORIGIN is set, only allow that origin.
        if let Ok(env_origin) = env::var("CORS_HTTP_ORIGIN") {
            if req_origin == env_origin.as_str() {
                return Some(env_origin);
            }
        }

        // If the request origin matches the allowed regex, allow only the request origin.
        let re = Regex::new(
            r"^https://forc(((.pub)|((-pub)(-git-[a-zA-Z0-9-]+-fuel-labs)?\.vercel\.app)))$",
        )
        .unwrap();
        if re.is_match(req_origin) {
            return Some(req_origin.to_string());
        }
    }
    None
}

// Build Cors Fairing.
#[rocket::async_trait]
impl Fairing for Cors {
    fn info(&self) -> Info {
        Info {
            name: "Cross-Origin-Resource-Sharing Fairing",
            kind: Kind::Response,
        }
    }

    // Build an Access-Control-Allow-Origin policy Response header.
    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        if let Some(origin) = get_allowed_origin(request.headers()) {
            response.set_header(Header::new("Access-Control-Allow-Origin", origin));
        }
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, PATCH, PUT, DELETE, HEAD, OPTIONS, GET",
        ));
        response.set_header(Header::new(
            "Access-Control-Allow-Headers",
            "*, Access-Control-Request-Headers, Content-Type",
        ));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
    }
}
