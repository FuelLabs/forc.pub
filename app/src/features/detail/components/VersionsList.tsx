import React from "react";
import { Box, Typography, Alert, CircularProgress, useTheme, useMediaQuery, Divider } from "@mui/material";
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      {versions.map((version: PackageVersionInfo, idx) => (
        <React.Fragment key={version.version}>
          <Box
            mb={2}
            p={2}
            className="version-item"
            display="flex"
            flexDirection={isMobile ? "column" : "row"}
            alignItems={isMobile ? "stretch" : "center"}
            width="100%"
            sx={{
              cursor: "pointer",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              },
              borderRadius: 2,
            }}
            onClick={() =>
              router.push(`/package/${packageName}/${version.version}`)
            }
          >
            {/* Version number */}
            <Box
              flexShrink={0}
              width={isMobile ? "100%" : 120}
              mr={isMobile ? 0 : 3}
              mb={isMobile ? 1 : 0}
            >
              <Typography
                variant={isMobile ? "body1" : "h4"}
                sx={{
                  fontWeight: "bold",
                  textAlign: isMobile ? "center" : "left",
                }}
              >
                {version.version}
              </Typography>
            </Box>
            {/* Details */}
            <Box flex={1} mb={isMobile ? 1 : 0}>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
                sx={{ textAlign: isMobile ? "left" : "left" }}
              >
                Published by {version.author.fullName} (@
                {version.author.githubLogin})
              </Typography>
              {version.license && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  gutterBottom
                  sx={{ textAlign: isMobile ? "left" : "left" }}
                >
                  License: {version.license}
                </Typography>
              )}
            </Box>
            {/* Published date */}
            <Box
              flexShrink={0}
              width={isMobile ? "100%" : 100}
              textAlign={isMobile ? "left" : "right"}
            >
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ fontSize: isMobile ? "0.85rem" : undefined }}
              >
                {formatTimeAgo(version.createdAt)}
              </Typography>
            </Box>
          </Box>
          {idx !== versions.length - 1 && <Divider sx={{ my: 1, background: "#444" }} />}
        </React.Fragment>
      ))}
    </Box>
  );
};
