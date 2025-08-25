"use client";

import React from "react";
import { useRouter } from "next/navigation";
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
  Chip,
} from "@mui/material";
import { FullPackage } from "../hooks/usePackageDetail";
import "./PackageSidebar.css";
import GavelIcon from "@mui/icons-material/Gavel";
import CodeIcon from "@mui/icons-material/Code";
import GitHubIcon from "@mui/icons-material/GitHub";
import DescriptionIcon from "@mui/icons-material/Description";
import HomeIcon from "@mui/icons-material/Home";
import LinkIcon from "@mui/icons-material/Link";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import LabelIcon from "@mui/icons-material/Label";

interface PackageSidebarProps {
  data: FullPackage | null;
  loading: boolean;
  error: string | null;
}

const PackageSidebar = ({ data, loading, error }: PackageSidebarProps) => {
  const router = useRouter();
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

        {/* Categories Section */}
        {data.categories && data.categories.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <LabelIcon fontSize="small" className="sidebar-icon" style={{ marginRight: 8, color: '#b0b0b0' }} />
              <Typography variant="h6" className="sidebar-section-heading">
                Categories
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {[...new Set(data.categories)].map((category) => (
                <Chip
                  key={category}
                  label={category}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ 
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "primary.main",
                      color: "white",
                    }
                  }}
                  onClick={() => {
                    const newParams = new URLSearchParams();
                    newParams.set("category", category);
                    newParams.set("page", "1");
                    router.push(`/?${newParams.toString()}`);
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Keywords Section */}
        {data.keywords && data.keywords.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <LocalOfferIcon fontSize="small" className="sidebar-icon" style={{ marginRight: 8, color: '#b0b0b0' }} />
              <Typography variant="h6" className="sidebar-section-heading">
                Keywords
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {[...new Set(data.keywords)].map((keyword) => (
                <Chip
                  key={keyword}
                  label={keyword}
                  size="small"
                  variant="outlined"
                  color="secondary"
                  sx={{ 
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "secondary.main",
                      color: "white",
                    }
                  }}
                  onClick={() => {
                    const newParams = new URLSearchParams();
                    newParams.set("keyword", keyword);
                    newParams.set("page", "1");
                    router.push(`/?${newParams.toString()}`);
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

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

        <div className="sidebar-link-item">
          <Typography variant="h6" className="sidebar-section-heading">
            Documentation
          </Typography>
          {data.documentation ? (
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
          ) : data.docsIpfsUrl ? (
            <Link
              href={`/docs/${data.name}/${data.version}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-light link-block"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <DescriptionIcon fontSize="small" style={{ marginRight: 6 }} />
              Auto-generated Documentation
            </Link>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No documentation available
            </Typography>
          )}
        </div>

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
