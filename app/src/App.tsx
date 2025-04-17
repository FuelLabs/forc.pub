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
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        <AppBar position="static">
          <Toolbar
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 3,
              px: 3,
              minHeight: '64px',
            }}
          >
            <Box
              onClick={() => navigate("/")}
              sx={{
                cursor: 'pointer',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'text.primary',
                '&:hover': {
                  opacity: 0.8,
                },
                transition: 'opacity 0.2s ease-in-out',
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
            p: 3,
            pt: 'calc(64px + 24px)',
            minHeight: '100vh',
            bgcolor: 'background.default',
            color: 'text.primary',
          }}
        >
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
