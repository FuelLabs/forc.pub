"use client";

import React, { Suspense, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useIsMobile } from "../hooks/useIsMobile";
import InputAdornment from "@mui/material/InputAdornment";
import { styled, useTheme } from "@mui/material";
import Input from "@mui/material/Input";
import SearchIcon from "@mui/icons-material/Search";
import dynamic from "next/dynamic";
import "./SearchBar.css";

function SearchBarComponent() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const theme = useTheme();

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const input = document.querySelector<HTMLInputElement>(
        ".search-input input",
      );
      if (input) {
        input.value = params.get("q") || "";
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const params = new URLSearchParams(window.location.search);

      if (newValue) {
        params.set("q", newValue);
        const newUrl =
          pathname === "/search"
            ? `${pathname}?${params.toString()}`
            : `/search?${params.toString()}`;
        window.history.pushState({ path: newUrl }, "", newUrl);
      } else if (pathname === "/search") {
        window.history.pushState({ path: "/" }, "", "/");
      }
    },
    [pathname],
  );

  return (
    <div className={isMobile ? "search-container-mobile" : "search-container"}>
      <Suspense key="search-bar" fallback={<div>Loading...</div>}>
        <StyledInput
          className="search-input"
          placeholder="Search packages..."
          fullWidth
          disableUnderline
          defaultValue={
            new URLSearchParams(window.location.search).get("q") || ""
          }
          onChange={handleChange}
          inputProps={{
            "aria-label": "search",
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
