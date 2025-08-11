"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Chip,
  Link,
  List,
  ListItem,
  ListItemText,
  Badge,
  Alert
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DescriptionIcon from "@mui/icons-material/Description";
import { searchPackages, getRecentPackages, PackageSearchResult, RecentPackagesResponse } from "../lib/api";

export default function DocsSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PackageSearchResult[]>([]);
  const [recentPackages, setRecentPackages] = useState<RecentPackagesResponse>({
    recentlyCreated: [],
    recentlyUpdated: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Load recent packages on component mount
    loadRecentPackages();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      handleSearch(debouncedQuery);
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery]);

  const loadRecentPackages = async () => {
    try {
      setLoading(true);
      const data = await getRecentPackages();
      setRecentPackages(data);
    } catch {
      setError("Failed to load recent packages");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const results = await searchPackages(query);
      setSearchResults(results);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const renderPackageCard = (pkg: PackageSearchResult) => (
    <Card key={`${pkg.name}-${pkg.version}`} variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Link
                href={`/docs/${pkg.name}/${pkg.version}`}
                variant="h6"
                color="primary"
                underline="hover"
                sx={{ cursor: "pointer" }}
                onClick={() => router.push(`/docs/${pkg.name}/${pkg.version}`)}
              >
                {pkg.name}
              </Link>
              <Typography variant="body2" color="text.secondary">
                v{pkg.version}
              </Typography>
              {pkg.hasDocumentation && (
                <Badge color="success" variant="dot">
                  <DescriptionIcon fontSize="small" color="action" />
                </Badge>
              )}
            </Box>
            
            {pkg.description && (
              <Typography variant="body2" color="text.secondary" paragraph>
                {pkg.description}
              </Typography>
            )}
            
            <Box display="flex" gap={1} flexWrap="wrap">
              {pkg.categories.map((category) => (
                <Chip
                  key={category}
                  label={category}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontSize: "0.7rem" }}
                />
              ))}
              {pkg.keywords.map((keyword) => (
                <Chip
                  key={keyword}
                  label={keyword}
                  size="small"
                  variant="outlined"
                  color="secondary"
                  sx={{ fontSize: "0.7rem" }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderPackageList = (packages: PackageSearchResult[], title: string) => (
    <Box mb={4}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {packages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No packages available
        </Typography>
      ) : (
        <List>
          {packages.slice(0, 10).map((pkg) => (
            <ListItem key={`${pkg.name}-${pkg.version}`} divider>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Link
                      href={`/docs/${pkg.name}/${pkg.version}`}
                      color="primary"
                      underline="hover"
                      sx={{ cursor: "pointer" }}
                      onClick={() => router.push(`/docs/${pkg.name}/${pkg.version}`)}
                    >
                      {pkg.name}
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                      v{pkg.version}
                    </Typography>
                    {pkg.hasDocumentation && (
                      <Badge color="success" variant="dot">
                        <DescriptionIcon fontSize="small" color="action" />
                      </Badge>
                    )}
                  </Box>
                }
                secondary={pkg.description}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box textAlign="center" mb={4}>
        <Typography variant="h3" component="h1" gutterBottom>
          Sway Package Documentation
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Browse and search auto-generated documentation for Sway packages
        </Typography>
      </Box>

      <Box mb={4}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search packages..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {searchQuery && searchResults.length > 0 && (
        <Box mb={4}>
          <Typography variant="h5" gutterBottom>
            Search Results
          </Typography>
          {searchResults.map(renderPackageCard)}
        </Box>
      )}

      {!searchQuery && (
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            {renderPackageList(recentPackages.recentlyCreated, "Recently Published")}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderPackageList(recentPackages.recentlyUpdated, "Recently Updated")}
          </Grid>
        </Grid>
      )}

      {searchQuery && searchResults.length === 0 && !loading && (
        <Box textAlign="center" mt={4}>
          <Typography variant="h6" color="text.secondary">
            No packages found matching &quot;{searchQuery}&quot;
          </Typography>
        </Box>
      )}
    </Container>
  );
}