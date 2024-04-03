extern crate reqwest;

use std::env;

use crate::api::User;
use serde::Deserialize;
use thiserror::Error;

#[derive(Deserialize, Debug)]
struct GithubOauthResponse {
    access_token: String,
}

#[derive(Error, Debug)]
pub enum GithubError {
    #[error("Failed to connect to GitHub")]
    Network(#[from] reqwest::Error),
    #[error("Failed to authenticate with GitHub. Status code: {0}")]
    Auth(String),
    #[error("Failed to fetch {name:?} from GitHub. Status code: {status:?})")]
    Api { name: String, status: String },
}

const GITHUB_CLIENT_ID: &str = "Iv1.ebdf596c6c548759";

pub async fn handle_login(code: String) -> Result<User, GithubError> {
    let access_token = exchange_code(code).await?;
    fetch_user(access_token).await
}

async fn exchange_code(code: String) -> Result<String, GithubError> {
    let client = reqwest::Client::new(); // todo: reuse client?
    let client_secret = env::var("GITHUB_CLIENT_SECRET").expect("GITHUB_CLIENT_SECRET not set");

    let res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .query(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("client_secret", &client_secret),
            ("code", code.as_str()),
        ])
        .send()
        .await
        .map_err(GithubError::Network)?;

    let status = res.status();

    let body = res
        .json::<GithubOauthResponse>()
        .await
        .map_err(|_| GithubError::Auth(status.to_string()))?;

    Ok(body.access_token)
}

async fn fetch_user(token: String) -> Result<User, GithubError> {
    let client = reqwest::Client::new();

    let res = client
        .get("https://api.github.com/user")
        .header("Accept", "application/json")
        .header("User-Agent", "Rust")
        .bearer_auth(token)
        .send()
        .await
        .map_err(GithubError::Network)?;

    let status = res.status();

    let body = res.json::<User>().await.map_err(|_| GithubError::Api {
        name: "user".to_string(),
        status: status.to_string(),
    })?;

    Ok(body)
}
