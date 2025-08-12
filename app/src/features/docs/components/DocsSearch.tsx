"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Typography,
  TextField,
  InputAdornment,
  Link,
  Alert
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { searchPackages, getRecentPackages, PackageSearchResult, RecentPackagesResponse } from "../lib/api";

export default function DocsSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PackageSearchResult[]>([]);
  const [recentPackages, setRecentPackages] = useState<RecentPackagesResponse>({
    recentlyCreated: [],
    recentlyUpdated: []
  });
  const [allPackages, setAllPackages] = useState<PackageSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Load recent packages and all packages on component mount
    loadRecentPackages();
    loadAllPackages();
  }, []);

  const loadAllPackages = async () => {
    try {
      const response = await fetch('/api/all_packages_temp');
      const data = await response.json();
      
      const mappedPackages = data.packages.map((pkg: any): PackageSearchResult => ({
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        categories: [],
        keywords: [],
        hasDocumentation: true,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt
      }));
      
      setAllPackages(mappedPackages);
    } catch (error) {
      console.error('Failed to load all packages:', error);
    }
  };

  // Add keyboard shortcut for search (S key or / key)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 's' || event.key === 'S' || event.key === '/') && !event.ctrlKey && !event.metaKey) {
        const activeElement = document.activeElement;
        // Don't trigger if user is already typing in an input
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
          event.preventDefault();
          // Focus the search input
          const searchInput = document.querySelector('input[placeholder*="search"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150); // Faster response for better UX

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim() && allPackages.length > 0) {
      handleSearch(debouncedQuery);
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery, allPackages]);

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

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Use only allPackages for search to avoid duplicates
    if (allPackages.length === 0) {
      setSearchResults([]);
      return;
    }

    const searchTerm = query.toLowerCase();
    
    const results = allPackages.filter(pkg => {
      const name = pkg.name.toLowerCase();
      const description = (pkg.description || '').toLowerCase();
      
      // Exact match gets highest priority
      if (name.includes(searchTerm) || description.includes(searchTerm)) {
        return true;
      }
      
      // Fuzzy match - check if all characters of search term appear in order in name
      let searchIndex = 0;
      for (let i = 0; i < name.length && searchIndex < searchTerm.length; i++) {
        if (name[i] === searchTerm[searchIndex]) {
          searchIndex++;
        }
      }
      
      return searchIndex === searchTerm.length;
    });

    // Remove duplicates based on name (just in case)
    const uniqueResults = results.filter((pkg, index, array) => 
      array.findIndex(p => p.name === pkg.name) === index
    );

    // Sort results by relevance (exact name match first, then partial matches)
    const sortedResults = uniqueResults.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      // Exact matches first
      if (aName === searchTerm && bName !== searchTerm) return -1;
      if (bName === searchTerm && aName !== searchTerm) return 1;
      
      // Starts with search term
      if (aName.startsWith(searchTerm) && !bName.startsWith(searchTerm)) return -1;
      if (bName.startsWith(searchTerm) && !aName.startsWith(searchTerm)) return 1;
      
      // Contains search term
      const aContains = aName.includes(searchTerm);
      const bContains = bName.includes(searchTerm);
      if (aContains && !bContains) return -1;
      if (bContains && !aContains) return 1;
      
      // Alphabetical order as fallback
      return aName.localeCompare(bName);
    });

    setSearchResults(sortedResults);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Helper function to calculate time since published
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const published = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - published.getTime()) / (1000 * 60));
    
    // Handle future dates by treating them as "just now"
    if (diffInMinutes <= 0) {
      return 'just now';
    }
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };

  const renderSearchResults = (packages: PackageSearchResult[]) => (
    <Box mt={4}>
      {packages.map((pkg) => (
        <Box
          key={`${pkg.name}-${pkg.version}`}
          sx={{
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '&:last-child': { borderBottom: 'none' }
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Link
              href={`/docs/${pkg.name}/${pkg.version}`}
              color="primary"
              underline="hover"
              variant="h6"
              sx={{ 
                cursor: "pointer",
                fontWeight: 500,
                fontSize: '1.1rem'
              }}
              onClick={() => router.push(`/docs/${pkg.name}/${pkg.version}`)}
            >
              {pkg.name}
            </Link>
            <Typography variant="body2" color="text.secondary">
              v{pkg.version}
            </Typography>
          </Box>
          {pkg.description && (
            <Typography variant="body2" color="text.secondary">
              {pkg.description}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );

  const renderRecentReleases = (packages: PackageSearchResult[]) => (
    <Box mt={6}>
      <Typography variant="h5" gutterBottom sx={{ 
        fontWeight: 600, 
        mb: 3
      }}>
        Recent Releases
      </Typography>
      
      {packages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No recent releases available
        </Typography>
      ) : (
        <Box>
          {packages.slice(0, 12).map((pkg) => (
            <Box
              key={`${pkg.name}-${pkg.version}`}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.02)'
                }
              }}
            >
              <Box flex={1}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Link
                    href={`/docs/${pkg.name}/${pkg.version}`}
                    color="primary"
                    underline="hover"
                    sx={{ 
                      cursor: "pointer",
                      fontWeight: 500,
                      fontSize: '1rem'
                    }}
                    onClick={() => router.push(`/docs/${pkg.name}/${pkg.version}`)}
                  >
                    {pkg.name}
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    v{pkg.version}
                  </Typography>
                </Box>
                {pkg.description && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      maxWidth: '70ch',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {pkg.description}
                  </Typography>
                )}
              </Box>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  ml: 2,
                  flexShrink: 0,
                  fontSize: '0.875rem'
                }}
              >
                {getTimeAgo(pkg.updatedAt || pkg.createdAt || new Date().toISOString())}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Header - similar to docs.rs */}
      <Box textAlign="center" mb={6}>
        <Box 
          component="img" 
          src="/sway_logo.png" 
          alt="Sway"
          sx={{ 
            height: 80,
            mb: 3,
            // Keep natural colors for the palm tree
          }}
        />
        <Typography 
          variant="h2" 
          component="h1" 
          sx={{ 
            fontWeight: 700,
            fontSize: { xs: '2.5rem', md: '3.5rem' },
            mb: 3,
            color: 'white'
          }}
        >
          docs.forc.pub
        </Typography>
      </Box>

      {/* Search Bar */}
      <Box display="flex" justifyContent="center" mb={2}>
        <TextField
          variant="outlined"
          placeholder="Type 'S' or '/' to search"
          value={searchQuery}
          onChange={handleSearchChange}
          sx={{ 
            width: { xs: '100%', sm: '500px' },
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'white',
              borderRadius: 1,
              fontSize: '1.1rem',
              '& fieldset': {
                borderColor: '#ccc',
              },
              '&:hover fieldset': {
                borderColor: '#999',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#007acc',
              },
            },
            '& .MuiInputBase-input': {
              py: 1.5,
              color: 'black'
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#666' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Search button */}
      <Box display="flex" justifyContent="center" mb={6}>
        <Box
          component="button"
          sx={{
            px: 3,
            py: 1,
            bgcolor: '#303134',
            color: 'white',
            border: '1px solid #303134',
            borderRadius: 1,
            cursor: 'pointer',
            fontSize: '0.875rem',
            '&:hover': {
              bgcolor: '#525355',
              borderColor: '#525355'
            }
          }}
          onClick={() => searchQuery && handleSearch(searchQuery)}
        >
          Search
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, maxWidth: '500px', mx: 'auto' }}>
          {error}
        </Alert>
      )}

      {/* Search Results */}
      {searchQuery && searchResults.length > 0 && (
        <Box maxWidth="800px" mx="auto">
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
            Search Results
          </Typography>
          {renderSearchResults(searchResults)}
        </Box>
      )}

      {/* Recent Releases - only show when not searching */}
      {!searchQuery && allPackages.length > 0 && (
        <Box maxWidth="800px" mx="auto">
          {renderRecentReleases(allPackages.slice().sort((a, b) => {
            // Sort by most recent update time (updatedAt), fallback to createdAt
            const aTime = new Date(a.updatedAt || a.createdAt || '0').getTime();
            const bTime = new Date(b.updatedAt || b.createdAt || '0').getTime();
            return bTime - aTime; // Most recent first
          }))}
        </Box>
      )}

      {/* No results message */}
      {searchQuery && searchResults.length === 0 && !loading && (
        <Box textAlign="center" mt={4} maxWidth="500px" mx="auto">
          <Typography variant="h6" color="text.secondary">
            No packages found matching &quot;{searchQuery}&quot;
          </Typography>
        </Box>
      )}
    </Container>
  );
}