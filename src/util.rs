use semver::Version;
use std::path::Path;

pub fn validate_or_format_semver(version: &str) -> Option<String> {
    // Remove the leading 'v' if it exists
    let version_trimmed = version.trim_start_matches('v');

    // Try to parse the version
    match Version::parse(version_trimmed) {
        Ok(parsed_version) => {
            // Return the version in the format with a leading 'v'
            Some(format!("{}", parsed_version))
        }
        Err(_) => None,
    }
}

pub fn load_env() {
    // Try to load variables from `.env` first
    if let Err(e) = dotenvy::dotenv() {
        tracing::error!("Could not load .env: {}", e);
    }

    // Then load `.env.local`, potentially overwriting values from `.env`
    if let Err(e) = dotenvy::from_path_override(Path::new(".env.local")) {
        tracing::error!("Could not load .env.local: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;
    use std::env;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_validate_or_format_semver() {
        let test_cases = vec![
            // Valid cases
            ("v1.2.3", Some("1.2.3".to_string())),
            ("1.2.3", Some("1.2.3".to_string())),
            ("v999.999.999", Some("999.999.999".to_string())),
            // Invalid cases
            ("1.2", None),
            ("v1.2", None),
            ("invalid", None),
            ("", None),
            // Edge cases
            (" 1.2.3 ", Some("1.2.3".to_string())),
        ];

        for (input, expected) in test_cases {
            assert_eq!(
                validate_or_format_semver(input.trim()),
                expected,
                "Failed on input: '{}'",
                input
            );
        }
    }

    #[test]
    #[serial]
    fn test_load_env() {
        // Save the current directory
        let original_dir = env::current_dir().unwrap();

        // Create a temporary directory
        let dir = tempdir().unwrap();
        let env_path = dir.path().join(".env");
        let local_env_path = dir.path().join(".env.local");
        env::set_current_dir(&dir).unwrap();

        // No env files exist
        load_env();
        assert!(env::var("TEST_VAR").is_err());

        // Only .env file exists
        fs::write(&env_path, "TEST_VAR=from_env\n").unwrap();
        load_env();
        assert_eq!(env::var("TEST_VAR").unwrap(), "from_env");

        // Both .env and .env.local files exist
        fs::write(&local_env_path, "TEST_VAR=from_env_local\n").unwrap();
        load_env();
        assert_eq!(env::var("TEST_VAR").unwrap(), "from_env_local");

        // Cleanup
        env::remove_var("TEST_VAR");
        env::set_current_dir(&original_dir).unwrap();
    }
}
