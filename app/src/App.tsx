import React, { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { AppBar, Toolbar, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import UserButton from "./features/toolbar/components/UserButton";
import { useIsMobile } from "./features/toolbar/hooks/useIsMobile";
import SearchBar from "./features/toolbar/components/SearchBar";
import theme from "./theme/theme";

interface AppProps {
  children?: ReactNode;
}

function App({ children }: AppProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <ThemeProvider theme={theme}>
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
              // display: 'flex',
              // justifyContent: 'space-between',
              // alignItems: 'center',
              // gap: 3,
              // px: 3,
              // minHeight: '64px',
            }}
          >
            <Box
              onClick={() => navigate("/")}
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
            <UserButton />
          </Toolbar>
          {isMobile && <SearchBar />}
        </AppBar>
        <Box
          component="main"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            // p: 3,
            // pt: 'calc(64px + 24px)',
            // minHeight: '100vh',
            // bgcolor: theme.palette.background.default,
            // color: theme.palette.text.primary,
          }}
        >
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
