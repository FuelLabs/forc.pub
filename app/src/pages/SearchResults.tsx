"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Pagination,
  Chip,
} from "@mui/material";
import HTTP, { PackagePreview } from "../utils/http";
import { formatDate } from "../utils/date";
import NextLink from "next/link";

const PER_PAGE = 10;

function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [results, setResults] = useState<PackagePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const abortControllerRef = useRef<AbortController>();
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const query = searchParams.get("query")?.trim() || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  useEffect(() => {
    // Clear any pending search timeout
    clearTimeout(searchTimeoutRef.current);

    if (!query) {
      setResults([]);
      setTotalPages(1);
      setTotalCount(0);
      setError(null);
      setLoading(false);
      abortControllerRef.current?.abort();
      return;
    }

    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    // Add small delay to reduce cancelled requests when typing fast
    searchTimeoutRef.current = setTimeout(() => {
      HTTP.get("/search", {
        params: {
          query,
          page: currentPage.toString(),
          per_page: PER_PAGE.toString(),
        },
        signal: abortControllerRef.current?.signal,
      })
        .then((response) => {
          setResults(response.data.data);
          setTotalPages(response.data.totalPages);
          setTotalCount(response.data.totalCount);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setError("Failed to fetch search results");
            console.error("Search error:", err);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }, 100); // 100ms delay to reduce cancelled requests

    return () => {
      clearTimeout(searchTimeoutRef.current);
      abortControllerRef.current?.abort();
    };
  }, [query, currentPage]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", page.toString());
    router.replace(`/?${newParams.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const containerStyles = {
    maxWidth: "1200px",
    mx: "auto",
    px: { xs: 1, sm: 2, md: 3 },
    width: "100%",
  };

  if (loading) {
    return (
      <Box sx={containerStyles} mt={4} display="flex" justifyContent="center">
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress />
          <Typography color="text.secondary">
            Searching for &quot;{query}&quot;...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={containerStyles} mt={4}>
        <Typography color="error" variant="h6" gutterBottom>
          Search Error
        </Typography>
        <Typography color="error">{error}</Typography>
        <Typography color="text.secondary" mt={2}>
          Please try again or contact support if the problem persists.
        </Typography>
      </Box>
    );
  }

  if (results.length === 0) {
    return (
      <Box sx={containerStyles} mt={4} textAlign="center">
        <Typography variant="h6" gutterBottom>
          No packages found
        </Typography>
        <Typography color="text.secondary">
          No results found for &quot;{query}&quot;. Try different keywords or
          check your spelling.
        </Typography>
      </Box>
    );
  }

  return (
    <Box mt={4} sx={containerStyles}>
      <Box mb={4}>
        <Typography variant="h5" gutterBottom>
          Search Results
        </Typography>
        <Typography color="text.secondary">
          Found {totalCount} package{totalCount === 1 ? "" : "s"} for &quot;
          {query}&quot;
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 1.5, sm: 2 }, marginBottom: { xs: 2, sm: 4 } }}>
        {results.map((result) => (
          <NextLink
            key={`${result.name}-${result.version}`}
            href={`/package/${result.name}`}
            style={{ textDecoration: "none" }}
          >
            <Card
              elevation={0}
              sx={{
                cursor: "pointer",
                border: "1px solid",
                borderColor: "divider",
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.02)",
                  borderColor: "primary.main",
                  transform: "translateY(-1px)",
                  transition: "all 0.2s ease-in-out",
                },
              }}
            >
              <CardContent
                sx={{
                  py: { xs: 2, sm: 3 },
                  pl: { xs: 2, sm: 3 },
                  pr: { xs: 2, sm: 4 },
                  "&:last-child": { pb: { xs: 2, sm: 3 } },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "200px 1fr 130px" },
                    gap: { xs: 1.5, sm: 3 },
                    alignItems: { xs: "start", sm: "center" },
                    rowGap: { xs: 0.5, sm: 0 },
                  }}
                >
                  <Box>
                    <Typography
                      variant="h6"
                      component="span"
                      sx={{
                        color: "primary.main",
                        fontWeight: 600,
                        fontSize: { xs: "1rem", sm: "1.1rem" },
                        display: "block",
                        mb: 0.5,
                      }}
                    >
                      {result.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        fontFamily: "monospace",
                        fontSize: { xs: "0.8rem", sm: "0.85rem" },
                      }}
                    >
                      v{result.version}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.primary", lineHeight: 1.5, fontSize: { xs: "0.9rem", sm: "0.95rem" }, mb: 1 }}
                    >
                      {result.description || "No description available"}
                    </Typography>
                    
                    {/* Categories and Keywords Tags */}
                    {(result.categories?.length > 0 || result.keywords?.length > 0) && (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                        {result.categories?.map((category) => (
                          <Chip
                            key={category}
                            label={category}
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{ 
                              fontSize: "0.75rem", 
                              height: "20px",
                              cursor: "pointer",
                              "&:hover": {
                                backgroundColor: "primary.main",
                                color: "white",
                              }
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const newParams = new URLSearchParams();
                              newParams.set("query", category);
                              newParams.set("page", "1");
                              window.location.href = `/?${newParams.toString()}`;
                            }}
                          />
                        ))}
                        {result.keywords?.map((keyword) => (
                          <Chip
                            key={keyword}
                            label={keyword}
                            size="small"
                            variant="outlined"
                            color="secondary"
                            sx={{ 
                              fontSize: "0.75rem", 
                              height: "20px",
                              cursor: "pointer",
                              "&:hover": {
                                backgroundColor: "secondary.main",
                                color: "white",
                              }
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Navigate to keyword search
                              const newParams = new URLSearchParams();
                              newParams.set("query", keyword);
                              newParams.set("page", "1");
                              window.location.href = `/?${newParams.toString()}`;
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>

                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontSize: { xs: "0.75rem", sm: "0.8rem" },
                      whiteSpace: "nowrap",
                      textAlign: { xs: "left", sm: "right" },
                      mt: { xs: 1, sm: 0 },
                    }}
                  >
                    Updated {formatDate(result.updatedAt)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </NextLink>
        ))}
      </Box>

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4, mb: 2 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
            size="medium"
          />
        </Box>
      )}
    </Box>
  );
}

export default function SearchResultsWrapper() {
  return (
    <Suspense fallback={<div>Loading search results...</div>}>
      <SearchResults />
    </Suspense>
  );
}
