use rocket::serde::Deserialize;

/// The publish request.
#[derive(Deserialize, Debug)]
pub struct PublishRequest {
    pub name: String,
    pub version: String,
}
