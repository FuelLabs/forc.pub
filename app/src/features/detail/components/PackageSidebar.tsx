"use client";

import React from "react";
import {
  Box,
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
import GavelIcon from "@mui/icons-material/Gavel";
import CodeIcon from "@mui/icons-material/Code";
import GitHubIcon from "@mui/icons-material/GitHub";
import DescriptionIcon from "@mui/icons-material/Description";
import HomeIcon from "@mui/icons-material/Home";
import LinkIcon from "@mui/icons-material/Link";

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
        <Typography variant="h6" className="sidebar-section-heading">
          Package Information
        </Typography>
        <Box className="info-grid">
          {data.license && (
            <Box display="flex" alignItems="center" mb={1}>
              <GavelIcon fontSize="small" className="sidebar-icon" style={{ marginRight: 8, color: '#b0b0b0' }} />
              <Typography variant="body2" className="info-label">License</Typography>
              <Typography variant="body2" className="info-value" sx={{ marginLeft: 'auto' }}>{data.license}</Typography>
            </Box>
          )}
          <Box display="flex" alignItems="center" mb={1}>
            <CodeIcon fontSize="small" className="sidebar-icon" style={{ marginRight: 8, color: '#b0b0b0' }} />
            <Typography variant="body2" className="info-label">Forc Version</Typography>
            <Typography variant="body2" className="info-value" sx={{ marginLeft: 'auto' }}>{data.forcVersion}</Typography>
          </Box>
        </Box>

        {data.repository && (
          <div className="sidebar-link-item">
            <Typography variant="h6" className="sidebar-section-heading">
              Repository
            </Typography>
            <Link
              href={data.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="link-light link-block"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <GitHubIcon fontSize="small" style={{ marginRight: 6 }} />
              {data.repository}
            </Link>
          </div>
        )}

        {data.documentation && (
          <div className="sidebar-link-item">
            <Typography variant="h6" className="sidebar-section-heading">
              Documentation
            </Typography>
            <Link
              href={data.documentation}
              target="_blank"
              rel="noopener noreferrer"
              className="link-light link-block"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <DescriptionIcon fontSize="small" style={{ marginRight: 6 }} />
              {data.documentation}
            </Link>
          </div>
        )}

        {data.homepage && (
          <div className="sidebar-link-item">
            <Typography variant="h6" className="sidebar-section-heading">
              Homepage
            </Typography>
            <Link
              href={data.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="link-light link-block"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <HomeIcon fontSize="small" style={{ marginRight: 6 }} />
              {data.homepage}
            </Link>
          </div>
        )}

        {data.urls && data.urls.length > 0 && (
          <div className="sidebar-link-item">
            <Typography variant="h6" className="sidebar-section-heading">
              Additional URLs
            </Typography>
            <List dense className="sidebar-list">
              {data.urls.map((url, index) => (
                <ListItem key={index} className="link-list-item">
                  <Link
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-light link-block"
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <LinkIcon fontSize="small" style={{ marginRight: 6 }} />
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
