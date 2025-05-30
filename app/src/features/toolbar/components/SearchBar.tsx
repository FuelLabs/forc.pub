"use client";

import React, {
  Suspense,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useIsMobile } from "../hooks/useIsMobile";
import InputAdornment from "@mui/material/InputAdornment";
import { styled, useTheme } from "@mui/material";
import Input from "@mui/material/Input";
import SearchIcon from "@mui/icons-material/Search";
import dynamic from "next/dynamic";
import "./SearchBar.css";

function SearchBarComponent() {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const [searchValue, setSearchValue] = useState(
    searchParams.get("query") || "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Create a styled version of Input with placeholder color override
  const StyledInput = styled(Input)({
    "& input::placeholder": {
      color: theme.palette.text.secondary,
      opacity: 1,
    },
    "& input": {
      color: theme.palette.text.primary,
    },
  });

  const updateSearchParams = useCallback((value: string) => {
    const url = new URL(window.location.href);

    if (value === "") {
      url.searchParams.delete("query");
      url.searchParams.delete("page");
      url.pathname = "/";
    } else {
      url.searchParams.set("query", value);
      url.searchParams.set("page", "1");
      url.pathname = "/search";
    }

    window.history.pushState({}, "", url);
  }, []);

  // Sync URL changes back to input
  useEffect(() => {
    const query = searchParams.get("query") || "";
    if (query !== searchValue) {
      setSearchValue(query);
    }
  }, [searchParams, searchValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setSearchValue(newValue);
      updateSearchParams(newValue);
    },
    [updateSearchParams],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setSearchValue("");
        updateSearchParams("");
      }
    },
    [updateSearchParams],
  );

  return (
    <div
      className={isMobile ? "search-container-mobile" : "search-container"}
      style={{ margin: 0, paddingLeft: "20px" }}
    >
      <Suspense key="search-bar" fallback={<div>Loading...</div>}>
        <StyledInput
          className="search-input"
          placeholder="Search packages..."
          fullWidth
          disableUnderline
          value={searchValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
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
      </Suspense>
    </div>
  );
}

const SearchBar = dynamic(() => Promise.resolve(SearchBarComponent), {
  ssr: false,
});

export default SearchBar;
