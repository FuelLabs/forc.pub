use semver::Version;
use std::time::SystemTime;

pub fn sys_time_to_epoch(sys_time: SystemTime) -> u64 {
    sys_time
        .duration_since(SystemTime::UNIX_EPOCH)
        .expect("convert time to epoch")
        .as_secs()
        * 1000
}

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
