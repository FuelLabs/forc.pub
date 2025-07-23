"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputAdornment from "@mui/material/InputAdornment";
import { styled, useTheme, useMediaQuery } from "@mui/material";
import Input from "@mui/material/Input";
import SearchIcon from "@mui/icons-material/Search";
import "./SearchBar.css";

const StyledInput = styled(Input)(({ theme }) => ({
  "& input::placeholder": {
    color: theme.palette.text.secondary,
    opacity: 1,
  },
  "& input": {
    color: theme.palette.text.primary,
  },
}));

function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchValue, setSearchValue] = useState(
    () => searchParams.get("query") || "",
  );
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  const updateURL = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const newParams = new URLSearchParams();
      
      // Preserve existing category and keyword filters
      const category = searchParams.get("category");
      const keyword = searchParams.get("keyword");
      
      if (trimmed) {
        newParams.set("query", trimmed);
      }
      if (category) {
        newParams.set("category", category);
      }
      if (keyword) {
        newParams.set("keyword", keyword);
      }
      newParams.set("page", "1");
      
      const url = newParams.toString() ? `/?${newParams.toString()}` : "/";
      router.replace(url, { scroll: false });
    },
    [router, searchParams],
  );

  const debouncedUpdateURL = useCallback(
    (value: string) => {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => updateURL(value), 400);
    },
    [updateURL],
  );

  useEffect(() => {
    const query = searchParams.get("query") || "";
    setSearchValue(query);
  }, [searchParams]);

  useEffect(() => {
    return () => clearTimeout(debounceTimeoutRef.current);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setSearchValue(newValue);
      debouncedUpdateURL(newValue);
    },
    [debouncedUpdateURL],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchValue("");
        clearTimeout(debounceTimeoutRef.current);
        updateURL("");
      } else if (e.key === "Enter") {
        clearTimeout(debounceTimeoutRef.current);
        updateURL(searchValue);
      }
    },
    [searchValue, updateURL],
  );

  return (
    <div
      className="search-container"
      style={{
        margin: 0,
        width: "100%",
        marginBottom: isMobile ? "0.25em" : "0",
      }}
    >
      <StyledInput
        className="search-input"
        placeholder="Search packages..."
        fullWidth
        disableUnderline
        value={searchValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        sx={{
          height: isMobile ? "2.5rem" : "auto",
          "& input": {
            height: isMobile ? "2.5rem" : "auto",
            padding: isMobile ? "0.5rem 0.5rem" : "auto",
          },
        }}
        inputProps={{
          "aria-label": "search",
          type: "search",
          autoComplete: "off",
        }}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon className="search-icon" />
          </InputAdornment>
        }
      />
    </div>
  );
}

export default SearchBar;
