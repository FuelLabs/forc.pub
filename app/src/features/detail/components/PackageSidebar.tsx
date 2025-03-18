import React from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  List,
  ListItem,
  Link,
  Typography,
} from "@mui/material";
import { FullPackage } from "../hooks/usePackageDetail";
import "./PackageSidebar.css";

interface PackageSidebarProps {
  data: FullPackage | null;
  loading: boolean;
  error: string | null;
}

const PackageSidebar = ({ data, loading, error }: PackageSidebarProps) => {
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ margin: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ margin: 4 }}>
        <Alert severity="info">No package information found.</Alert>
      </Box>
    );
  }

  return (
    <Card variant="outlined" className="sidebar-card">
      <CardContent>
        {/* Package Information Section */}
        <Typography variant="subtitle1" className="sidebar-section-heading">
          Package Information
        </Typography>
        <Grid container spacing={1} className="info-grid">
          {data.license && (
            <>
              <Grid item xs={6} className="info-label-col">
                <Typography variant="body2" className="info-label">
                  License
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">{data.license}</Typography>
              </Grid>
            </>
          )}

          <Grid item xs={6} className="info-label-col">
            <Typography variant="body2" className="info-label">
              Forc Version
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2">{data.forcVersion}</Typography>
          </Grid>
        </Grid>

        {/* Removed divider */}

        {data.repository && (
          <div className="sidebar-link-item">
            <Typography variant="subtitle1" className="sidebar-section-heading">
              Repository
            </Typography>
            <Link
              href={data.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="link-light link-block"
            >
              {data.repository}
            </Link>
          </div>
        )}

        {data.documentation && (
          <div className="sidebar-link-item">
            <Typography variant="subtitle1" className="sidebar-section-heading">
              Documentation
            </Typography>

            <Link
              href={data.documentation}
              target="_blank"
              rel="noopener noreferrer"
              className="link-light link-block"
            >
              {data.documentation}
            </Link>
          </div>
        )}

        {data.homepage && (
          <div className="sidebar-link-item">
            <Typography variant="subtitle1" className="sidebar-section-heading">
              Homepage
            </Typography>
            <Link
              href={data.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="link-light link-block"
            >
              {data.homepage}
            </Link>
          </div>
        )}

        {data.urls && data.urls.length > 0 && (
          <div className="sidebar-link-item">
            <Typography variant="subtitle1" className="sidebar-section-heading">
              Additional URLs
            </Typography>
            <List dense disablePadding className="sidebar-list">
              {data.urls.map((url, index) => (
                <ListItem key={index} disablePadding className="link-list-item">
                  <Link
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-light link-block"
                  >
                    {url}
                  </Link>
                </ListItem>
              ))}
            </List>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PackageSidebar;
