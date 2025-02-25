//! This module handles everything to do with index files.
//!
//! Index files are for creating set of information for identifying a published
//! package. They are used by forc while fetching to actually convert a registry
//! index into a IPFS CID. We also add some metadata to this index files to
//! enable forc to do "more clever" fetching during build process. By moving
//! dependency resolution from the time a package is fetched to the point we
//! start fetching we are actively enabling forc to fetch packages and their
//! dependencies in parallel.
//!
//! There are two main things forc.pub needs to be able to do for index files:
//!   1: Creation of index files from published packages
//!   2: Calculating correct path for given package index.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Serialize, Deserialize)]
pub struct IndexFile {
    /// Each published instance for this specific package, keyed by their
    /// versions. The reason we are doing this type of mapping is for use of
    /// ease, we are effectively duplicating version of package but keeping
    /// `PackageEntry` self contained.
    #[serde(flatten)]
    versions: BTreeMap<semver::Version, PackageEntry>,
}

/// A unique representation of each published package to `forc.pub`. Contains:
///
/// 1. The name of the package.
/// 2. The version of the package.
/// 3. CID of the package's source code. This is how forc actually resolves a
///    package name, version information into actual information on how to get
///    the package.
/// 4. CID of the package's abi if the package is a contract.
/// 5. Dependencies of this package. If there are other packages this package
///    depends on, some information can be directly found in the root package
///    to enable parallel fetching.
#[derive(Serialize, Deserialize)]
pub struct PackageEntry {
    /// Name of the package.
    /// This is the actual package name needed in forc.toml file to fetch this
    /// package.
    package_name: String,
    /// Version of the package.
    /// This is the actual package version needed in forc.toml file to fetch
    /// this package.
    version: semver::Version,
    /// IPFS CID of this specific package's source code. This is pinned by
    /// forc.pub at the time of package publishing and thus will be
    /// available all the time.
    source_cid: String,
    /// IPFS CID of this specific package's abi. This is pinned by
    /// forc.pub at the time of package publishing and thus will be
    /// available all the time if this exists in the first place, i.e the
    /// package is a contract.
    abi_cid: Option<String>,
    /// Dependencies of the current package entry. Can be consumed to enable
    /// parallel fetching by the consumers of this index, mainly forc.
    dependencies: Vec<Box<PackageEntry>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_deserialize_empty_index() {
        let index = IndexFile {
            versions: BTreeMap::new(),
        };

        let serialized = serde_json::to_string(&index).unwrap();
        assert_eq!(serialized, "{}");
        let deserialized: IndexFile = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.versions.len(), 0);
    }

    #[test]
    fn test_specific_json_format() {
        // Test parsing a specific JSON format example
        let json = r#"{
            "0.12.0": {
                "package_name": "example-package",
                "version": "0.12.0",
                "source_cid": "QmExampleHash",
                "abi_cid": "QmExampleAbiHash",
                "dependencies": []
            },
            "0.11.0": {
                "package_name": "example-package",
                "version": "0.11.0",
                "source_cid": "QmOlderHash",
                "abi_cid": "QmOlderAbiHash",
                "dependencies": []
            }
        }"#;

        let deserialized: IndexFile = serde_json::from_str(json).unwrap();

        assert_eq!(deserialized.versions.len(), 2);
        assert!(deserialized
            .versions
            .contains_key(&semver::Version::new(0, 11, 0)));
        assert!(deserialized
            .versions
            .contains_key(&semver::Version::new(0, 12, 0)));

        let v011 = &deserialized.versions[&semver::Version::new(0, 11, 0)];
        assert_eq!(v011.source_cid, "QmOlderHash");
        assert_eq!(v011.abi_cid, Some("QmOlderAbiHash".to_string()));

        let v012 = &deserialized.versions[&semver::Version::new(0, 12, 0)];
        assert_eq!(v012.source_cid, "QmExampleHash");
        assert_eq!(v012.abi_cid, Some("QmExampleAbiHash".to_string()));
    }

    #[test]
    fn test_json_with_dependencies() {
        // Test parsing a JSON with nested dependencies
        let json = r#"{
        "1.0.0": {
            "package_name": "main-package",
            "version": "1.0.0",
            "source_cid": "QmMainHash",
            "abi_cid": null,
            "dependencies": [
                {
                    "package_name": "dep-package",
                    "version": "0.5.0",
                    "source_cid": "QmDepHash",
                    "abi_cid": "QmDepAbiHash",
                    "dependencies": []
                },
                {
                    "package_name": "another-dep",
                    "version": "0.9.1",
                    "source_cid": "QmAnotherDepHash",
                    "abi_cid": null,
                    "dependencies": [
                        {
                            "package_name": "nested-dep",
                            "version": "0.2.0",
                            "source_cid": "QmNestedHash",
                            "abi_cid": "QmNestedAbiHash",
                            "dependencies": []
                        }
                    ]
                }
            ]
        }
    }"#;

        let deserialized: IndexFile = serde_json::from_str(json).unwrap();

        // Verify main package
        assert_eq!(deserialized.versions.len(), 1);
        assert!(deserialized
            .versions
            .contains_key(&semver::Version::new(1, 0, 0)));

        let main_pkg = &deserialized.versions[&semver::Version::new(1, 0, 0)];
        assert_eq!(main_pkg.package_name, "main-package");
        assert_eq!(main_pkg.source_cid, "QmMainHash");
        assert_eq!(main_pkg.abi_cid, None);

        // Verify first-level dependencies
        assert_eq!(main_pkg.dependencies.len(), 2);

        // Check first dependency
        let dep1 = &main_pkg.dependencies[0];
        assert_eq!(dep1.package_name, "dep-package");
        assert_eq!(dep1.version, semver::Version::new(0, 5, 0));
        assert_eq!(dep1.source_cid, "QmDepHash");
        assert_eq!(dep1.abi_cid, Some("QmDepAbiHash".to_string()));
        assert_eq!(dep1.dependencies.len(), 0);

        // Check second dependency
        let dep2 = &main_pkg.dependencies[1];
        assert_eq!(dep2.package_name, "another-dep");
        assert_eq!(dep2.version, semver::Version::new(0, 9, 1));
        assert_eq!(dep2.source_cid, "QmAnotherDepHash");
        assert_eq!(dep2.abi_cid, None);

        // Verify nested dependency
        assert_eq!(dep2.dependencies.len(), 1);
        let nested_dep = &dep2.dependencies[0];
        assert_eq!(nested_dep.package_name, "nested-dep");
        assert_eq!(nested_dep.version, semver::Version::new(0, 2, 0));
        assert_eq!(nested_dep.source_cid, "QmNestedHash");
        assert_eq!(nested_dep.abi_cid, Some("QmNestedAbiHash".to_string()));
        assert_eq!(nested_dep.dependencies.len(), 0);

        // Test round-trip serialization
        let serialized = serde_json::to_string_pretty(&deserialized).unwrap();

        // Deserialize again to ensure it's valid
        let re_deserialized: IndexFile = serde_json::from_str(&serialized).unwrap();
        assert_eq!(re_deserialized.versions.len(), 1);

        // Verify the structure is preserved
        let main_pkg2 = &re_deserialized.versions[&semver::Version::new(1, 0, 0)];
        assert_eq!(main_pkg2.dependencies.len(), 2);
        assert_eq!(main_pkg2.dependencies[1].dependencies.len(), 1);
    }

    #[test]
    fn test_json_with_missing_optional_fields() {
        // Test parsing a JSON where some optional fields are missing
        let json = r#"{
            "0.5.0": {
                "package_name": "minimal-package",
                "version": "0.5.0",
                "source_cid": "QmMinimalHash",
                "dependencies": []
            }
        }"#;

        let deserialized: IndexFile = serde_json::from_str(json).unwrap();

        assert_eq!(deserialized.versions.len(), 1);
        let pkg = &deserialized.versions[&semver::Version::new(0, 5, 0)];
        assert_eq!(pkg.package_name, "minimal-package");
        assert_eq!(pkg.source_cid, "QmMinimalHash");
        assert_eq!(pkg.abi_cid, None);
    }
}
