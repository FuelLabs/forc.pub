"use client";

import React, { Suspense, useEffect, useState } from "react";
import {
  useRouter,
  useSearchParams,
  ReadonlyURLSearchParams,
} from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Pagination,
} from "@mui/material";
import HTTP, { PackagePreview } from "../utils/http";
import { formatDate } from "../utils/date";
import NextLink from "next/link";

export interface SearchResultsProps {
  searchParams: URLSearchParams | ReadonlyURLSearchParams;
}

const PER_PAGE = 10;

function SearchResults({ searchParams }: SearchResultsProps) {
  const router = useRouter();
  const [results, setResults] = useState<PackagePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const query = searchParams.get("query");
    const page = parseInt(searchParams.get("page") || "1", 10);
    setCurrentPage(page);

    if (!query) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    HTTP.get("/search", {
      params: {
        query,
        page: page.toString(),
        per_page: PER_PAGE.toString(),
      },
    })
      .then((response) => {
        setResults(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotalCount(response.data.totalCount);
      })
      .catch((err) => {
        setError("Failed to fetch search results");
        console.error("Search error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams]);

  const containerStyles = {
    maxWidth: "1200px",
    mx: "auto",
    px: 3,
    width: "100%",
  };

  if (loading) {
    return (
      <Box sx={containerStyles} mt={4} display="flex" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={containerStyles} mt={4}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (results.length === 0) {
    return (
      <Box sx={containerStyles} mt={4}>
        <Typography>No results found</Typography>
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
          Found {totalCount} package{totalCount === 1 ? "" : "s"}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {results.map((result) => (
          <NextLink
            key={result.name}
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
                  py: 3,
                  pl: 3,
                  pr: 4,
                  "&:last-child": { pb: 3 },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr 130px",
                    gap: 3,
                    alignItems: "center",
                  }}
                >
                  <Box>
                    <Typography
                      variant="h6"
                      component="span"
                      sx={{
                        color: "primary.main",
                        fontWeight: 600,
                        fontSize: "1.1rem",
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
                        fontSize: "0.85rem",
                      }}
                    >
                      v{result.version}
                    </Typography>
                  </Box>

                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.primary",
                      lineHeight: 1.5,
                    }}
                  >
                    {result.description || ""}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.8rem",
                      whiteSpace: "nowrap",
                      textAlign: "right",
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
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mt: 4,
            mb: 2,
          }}
        >
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_, page) => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set("page", page.toString());
              router.replace(`/search?${newParams.toString()}`);
            }}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
}

export default function SearchResultsWrapper() {
  const searchParams = useSearchParams();

  return (
    <Suspense fallback={<div>Loading search results...</div>}>
      <SearchResults searchParams={searchParams} />
    </Suspense>
  );
}
