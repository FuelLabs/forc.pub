use regex::Regex;
use rocket::serde::{Deserialize, Serialize};
use serde::Deserializer;
use url::Url;
use uuid::Uuid;

fn is_valid_package_name(name: &str) -> bool {
    // Must start with a letter, can contain letters, numbers, underscores and hyphens
    let re = Regex::new(r"^[a-zA-Z][\w-]*$").unwrap();
    re.is_match(name)
}

fn is_valid_package_version(name: &str) -> bool {
    // Must start with an alphanumeric character, can contain only letters, numbers, underscores, dots and hyphens
    let re = Regex::new(r"^[a-zA-Z0-9][\w.-]*$").unwrap();
    re.is_match(name)
}

/// The publish request.
#[derive(Deserialize, Debug)]
pub struct PublishRequest {
    #[serde(deserialize_with = "validate_package_name")]
    pub package_name: String,
    pub upload_id: Uuid,
    #[serde(deserialize_with = "validate_package_version")]
    pub num: String,
    pub package_description: Option<String>,
    pub repository: Option<Url>,
    pub documentation: Option<Url>,
    pub homepage: Option<Url>,
    pub urls: Vec<Url>,
    pub readme: Option<String>,
    pub license: Option<String>,
}

fn validate_package_name<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let name = String::deserialize(deserializer)?;
    if !is_valid_package_name(&name) {
        return Err(serde::de::Error::custom(
            "Package name must start with a letter and contain only letters, numbers, underscores or hyphens"
        ));
    }
    Ok(name)
}

fn validate_package_version<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let name = String::deserialize(deserializer)?;
    if !is_valid_package_version(&name) {
        return Err(serde::de::Error::custom(
            "Package version must start with an alphanumeric character, can contain only letters, numbers, underscores, dots and hyphens",
        ));
    }
    Ok(name)
}

/// The response to an upload_project request.
#[derive(Serialize, Debug)]
pub struct UploadResponse {
    pub upload_id: Uuid,
}
