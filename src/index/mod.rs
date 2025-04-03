pub mod handler;

use crate::handlers::publish::PartialPackageDep;
use forc_pkg::source::reg::index_file::PackageDependencyIdentifier;

impl From<PartialPackageDep> for PackageDependencyIdentifier {
    fn from(value: PartialPackageDep) -> Self {
        PackageDependencyIdentifier::new(
            value.dependency_package_name,
            value.dependency_version_req,
        )
    }
}
