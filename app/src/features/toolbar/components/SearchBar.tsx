import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import InputAdornment from "@mui/material/InputAdornment/InputAdornment";
import { styled } from "@mui/material/styles";
import Input from "@mui/material/Input/Input";
import SearchIcon from "@mui/icons-material/Search";
import "./SearchBar.css";

// Create a styled version of Input with placeholder color override
const StyledInput = styled(Input)({
  "& input::placeholder": {
    color: "#c0c0c0",
    opacity: 1,
  },
  "& input": {
    color: "#e0e0e0",
  },
});

function SearchBar() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  return (
    <div className={isMobile ? "search-container-mobile" : "search-container"}>
      <StyledInput
        className="search-input"
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon className="search-icon" />
          </InputAdornment>
        }
        placeholder="Search packages and plugins"
        inputProps={{
          "aria-label": "search",
        }}
        onChange={(e) => {
          const newSearch = e.currentTarget.value;

          if (!newSearch.length) {
            if (pathname === "/search") {
              navigate("/");
            }
            searchParams.delete("q");
            setSearchParams(searchParams);
          } else {
            if (pathname !== "/search") {
              navigate("/search");
            }
            searchParams.set("q", newSearch);
            setSearchParams(searchParams);
          }
        }}
      />
    </div>
  );
}

export default SearchBar;
