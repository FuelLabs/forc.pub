"use client";

import React, { ReactNode, Suspense } from "react";
import { AppBar, Toolbar, Box, useTheme } from "@mui/material";
import UserButton from "./features/toolbar/components/UserButton";
import { useIsMobile } from "./features/toolbar/hooks/useIsMobile";
import SearchBar from "./features/toolbar/components/SearchBar";

interface AppProps {
  children?: ReactNode;
}

function App({ children }: AppProps) {
  const isMobile = useIsMobile();
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        textAlign: "center",
        backgroundColor: theme.palette.background.default,
        height: "100vh",
        color: theme.palette.text.primary,
        overflow: "hidden",
      }}
    >
      <AppBar position="static">
        <Toolbar
          sx={{
            backgroundColor: "#181818",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
          }}
        >
          <Box
            onClick={() => (window.location.href = "/")}
            sx={{
              flexGrow: 1,
              display: "block",
              color: theme.palette.primary.main,
              fontSize: "24px",
              fontFamily: "monospace",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "color 0.2s ease-in-out",
              "&:hover": {
                color: theme.palette.primary.light,
              },
            }}
          >
            forc.pub
          </Box>
          {!isMobile && <SearchBar />}
          <Suspense fallback={<div>Loading...</div>}>
            <UserButton />
          </Suspense>
        </Toolbar>
        {isMobile && <SearchBar />}
      </AppBar>
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default App;
