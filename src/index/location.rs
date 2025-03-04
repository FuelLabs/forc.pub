use std::path::PathBuf;

use super::PackageEntry;

/// Type of the namespace.
pub enum Namespace {
    /// Flat namespace means no specific namespace for different domains.
    /// Location calculator won't be adding anything specific for this to the
    /// file location.
    Flat,
    /// Domain namespace means we have custom namespaces and first component of
    /// the file location of the index file will be the domain of the namespace.
    Domain(String),
}

/// Settings to configure file location calculator
pub struct LocationConfiguration {
    /// The number of letters used to chunk package name.
    ///
    /// Example:
    /// If set to 2, and package name is "foobar", the index file location
    /// will be ".../fo/ob/ar/foobar".
    chunking_size: usize,
    /// Type of the namespacing is needed to determine whether to add domain at
    /// the beginnig of the file location.
    namespace: Namespace,
}

/// Calculates the exact file location from the root of the namespace repo.
/// If the configuration includes a namespace, it will be the first part of
/// the path followed by chunks.
pub fn location_from_root(config: LocationConfiguration, package_entry: &PackageEntry) -> PathBuf {
    let mut path = PathBuf::new();

    // Add domain to path if namespace is 'Domain'
    // otherwise skip.
    if let Namespace::Domain(domain) = config.namespace {
        path.push(domain);
    }

    let package_name = &package_entry.name;

    // If chunking is disabled we do not have any folder in the index.
    if config.chunking_size == 0 {
        path.push(package_name);
        return path;
    }

    let chars: Vec<char> = package_name.chars().collect();
    for chunk in chars.chunks(config.chunking_size) {
        let chunk_str: String = chunk.iter().collect();
        path.push(chunk_str);
    }

    path.push(package_name);
    path
}

#[cfg(test)]
mod tests {
    use semver::Version;

    use super::*;
    use std::path::Path;

    fn create_package_entry(name: &str) -> PackageEntry {
        PackageEntry {
            name: name.to_string(),
            version: Version::new(1, 0, 0),
            source_cid: "QmHash".to_string(),
            abi_cid: None,
            dependencies: vec![],
        }
    }

    #[test]
    fn test_flat_namespace_with_small_package() {
        let config = LocationConfiguration {
            chunking_size: 2,
            namespace: Namespace::Flat,
        };
        let entry = create_package_entry("ab");

        let path = location_from_root(config, &entry);

        assert_eq!(path, Path::new("ab").join("ab"));
    }

    #[test]
    fn test_flat_namespace_with_regular_package() {
        let config = LocationConfiguration {
            chunking_size: 2,
            namespace: Namespace::Flat,
        };
        let entry = create_package_entry("foobar");

        let path = location_from_root(config, &entry);

        // Should produce: fo/ob/ar/foobar
        assert_eq!(path, Path::new("fo").join("ob").join("ar").join("foobar"));
    }

    #[test]
    fn test_domain_namespace() {
        let config = LocationConfiguration {
            chunking_size: 2,
            namespace: Namespace::Domain("example.com".to_string()),
        };
        let entry = create_package_entry("foobar");

        let path = location_from_root(config, &entry);

        // Should produce: example.com/fo/ob/ar/foobar
        assert_eq!(
            path,
            Path::new("example.com")
                .join("fo")
                .join("ob")
                .join("ar")
                .join("foobar")
        );
    }

    #[test]
    fn test_odd_length_package_name() {
        let config = LocationConfiguration {
            chunking_size: 2,
            namespace: Namespace::Flat,
        };
        let entry = create_package_entry("hello");

        let path = location_from_root(config, &entry);

        // Should produce: he/ll/o/hello
        assert_eq!(path, Path::new("he").join("ll").join("o").join("hello"));
    }

    #[test]
    fn test_larger_chunking_size() {
        let config = LocationConfiguration {
            chunking_size: 3,
            namespace: Namespace::Flat,
        };
        let entry = create_package_entry("fibonacci");

        let path = location_from_root(config, &entry);

        // Should produce: fib/ona/cci/fibonacci
        assert_eq!(
            path,
            Path::new("fib").join("ona").join("cci").join("fibonacci")
        );
    }

    #[test]
    fn test_chunking_size_larger_than_name() {
        let config = LocationConfiguration {
            chunking_size: 10,
            namespace: Namespace::Flat,
        };
        let entry = create_package_entry("small");

        let path = location_from_root(config, &entry);

        // Should produce: small/small
        assert_eq!(path, Path::new("small").join("small"));
    }

    #[test]
    fn test_unicode_package_name() {
        let config = LocationConfiguration {
            chunking_size: 2,
            namespace: Namespace::Flat,
        };
        let entry = create_package_entry("héllo");

        let path = location_from_root(config, &entry);

        // Should produce: hé/ll/o/héllo
        assert_eq!(path, Path::new("hé").join("ll").join("o").join("héllo"));
    }

    #[test]
    fn test_empty_package_name() {
        let config = LocationConfiguration {
            chunking_size: 2,
            namespace: Namespace::Flat,
        };
        let entry = create_package_entry("");

        let path = location_from_root(config, &entry);

        // Should just produce: ""
        assert_eq!(path, Path::new(""));
    }

    #[test]
    fn test_chunking_size_zero() {
        let config = LocationConfiguration {
            chunking_size: 0,
            namespace: Namespace::Flat,
        };
        let entry = create_package_entry("package");

        let path = location_from_root(config, &entry);

        // Should just produce: package
        assert_eq!(path, Path::new("package"));
    }
}
