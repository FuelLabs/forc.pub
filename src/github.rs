extern crate reqwest;

use crate::api::auth::User;
use serde::Deserialize;
use std::env;
use thiserror::Error;

#[derive(Deserialize, Debug)]
struct GithubOauthResponse {
    access_token: String,
    expires_in: u32,
}

#[derive(Deserialize, Debug)]
struct GithubUserResponse {
    pub name: Option<String>,
    pub id: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub html_url: String,
    pub login: String,
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

pub async fn handle_login(code: String) -> Result<(User, u32), GithubError> {
    let (access_token, expires_in) = exchange_code(code).await?;
    let user = fetch_user(access_token).await?;
    Ok((user, expires_in))
}

async fn exchange_code(code: String) -> Result<(String, u32), GithubError> {
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

    Ok((body.access_token, body.expires_in))
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

    let body = res
        .json::<GithubUserResponse>()
        .await
        .map_err(|_| GithubError::Api {
            name: "user".to_string(),
            status: status.to_string(),
        })?;

    let user = User {
        full_name: body.name.unwrap_or(body.login.clone()),
        github_id: body.id,
        email: body.email,
        avatar_url: body.avatar_url,
        github_url: body.html_url,
        github_login: body.login,
        is_admin: false, // TODO: Check if user is admin
    };
    Ok(user)
}
