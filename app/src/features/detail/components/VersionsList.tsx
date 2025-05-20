import React from "react";
import { Box, Typography, Alert, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { PackageVersionInfo } from "../../../utils/http";
import { formatTimeAgo } from "../../../utils/date";

interface VersionsListProps {
  loading: boolean;
  error: string | null;
  versions: PackageVersionInfo[];
  packageName: string;
}

export const VersionsList: React.FC<VersionsListProps> = ({
  loading,
  error,
  versions,
  packageName,
}) => {
  const router = useRouter();
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" className="alert-dark">
        {error}
      </Alert>
    );
  }

  if (versions.length === 0) {
    return (
      <Alert severity="info" className="alert-dark">
        No versions found for this package.
      </Alert>
    );
  }

  return (
    <Box>
      {versions.map((version: PackageVersionInfo) => (
        <Box
          key={version.version}
          mb={2}
          p={2}
          className="version-item"
          display="flex"
          alignItems="flex-start"
          width="100%"
          sx={{
            cursor: "pointer",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            },
          }}
          onClick={() =>
            router.push(`/package/${packageName}/${version.version}`)
          }
        >
          <Box flexShrink={0} width={120} mr={3}>
            <Typography variant="h4" sx={{ fontWeight: "bold" }}>
              {version.version}
            </Typography>
          </Box>
          <Box flex={1}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Published by {version.author.fullName} (@
              {version.author.githubLogin})
            </Typography>
            {version.license && (
              <Typography variant="body2" color="textSecondary" gutterBottom>
                License: {version.license}
              </Typography>
            )}
          </Box>
          <Box flexShrink={0} width={100} textAlign="right">
            <Typography variant="body2" color="textSecondary">
              {formatTimeAgo(version.createdAt)}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
