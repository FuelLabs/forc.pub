"use client";

import React, { ReactNode, Suspense } from "react";
import { AppBar, Toolbar, Box, useTheme, Container } from "@mui/material";
import UserButton from "./features/toolbar/components/UserButton";
import SearchBar from "./features/toolbar/components/SearchBar";

interface AppProps {
  children?: ReactNode;
}

function App({ children }: AppProps) {
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
      <AppBar 
        position="static"
        sx={{
          backgroundColor: "#181818",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
        }}
      >
        <Container maxWidth="lg">
          <Toolbar
            sx={{
              backgroundColor: "transparent",
              boxShadow: "none",
              padding: { xs: "8px 0", sm: "6px 0" },
              gap: { xs: 1, sm: 2 },
              flexWrap: { xs: "wrap", sm: "nowrap" },
              alignItems: "center",
            }}
          >
            <Box
              onClick={() => (window.location.href = "/")}
              sx={{
                color: theme.palette.primary.main,
                fontSize: "24px",
                fontFamily: "monospace",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "color 0.2s ease-in-out",
                flexShrink: 0,
                order: { xs: 1, sm: 1 },
                "&:hover": {
                  color: theme.palette.primary.light,
                },
              }}
            >
              forc.pub
            </Box>
            <Box
              sx={{
                flexGrow: 1,
                order: { xs: 3, sm: 2 },
                flexBasis: { xs: "100%", sm: "auto" },
              }}
            >
              <Suspense fallback={<div></div>}>
                <SearchBar />
              </Suspense>
            </Box>
            <Box
              sx={{
                flexShrink: 0,
                order: { xs: 2, sm: 3 },
                marginLeft: { xs: "auto", sm: 0 },
              }}
            >
              <Suspense fallback={<div>Loading...</div>}>
                <UserButton />
              </Suspense>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default App;
