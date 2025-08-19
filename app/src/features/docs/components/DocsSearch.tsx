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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Load recent packages on component mount
    loadRecentPackages();
  }, []);

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
      
      // Use the search API to get all matching packages from the registry
      const results = await searchPackages(query);
      
      // Filter for packages that have documentation (docsIpfsUrl is not null)
      const packagesWithDocs = results.filter(pkg => pkg.docsIpfsUrl !== null);
      
      // Sort results by relevance
      const searchTerm = query.toLowerCase();
      const sortedResults = packagesWithDocs.sort((a, b) => {
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
    } catch (error) {
      console.error('Search failed:', error);
      setError('Failed to search packages');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
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
        mb: 3,
        borderBottom: '2px solid #00f58c',
        paddingBottom: '8px'
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
            fontSize: { xs: '2rem', md: '2.8rem' },
            mb: 3,
            color: 'white'
          }}
        >
          docs.forc.pub
        </Typography>
      </Box>

      {/* Search Bar */}
      <Box display="flex" justifyContent="center" mb={6}>
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
      {!searchQuery && recentPackages.recentlyUpdated.length > 0 && (
        <Box maxWidth="800px" mx="auto">
          {renderRecentReleases(
            recentPackages.recentlyUpdated
              .filter(pkg => pkg.docsIpfsUrl !== null)
              .sort((a, b) => {
                // Sort by most recent update time (updatedAt), fallback to createdAt
                const aTime = new Date(a.updatedAt || a.createdAt || '0').getTime();
                const bTime = new Date(b.updatedAt || b.createdAt || '0').getTime();
                return bTime - aTime; // Most recent first
              })
          )}
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