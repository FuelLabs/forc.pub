import React from "react";
import { Box, AppBar, Toolbar, Button } from "@mui/material";
import Link from "next/link";
import HomeIcon from "@mui/icons-material/Home";

export const metadata = {
  title: {
    template: '%s | Sway Documentation - forc.pub',
    default: 'Sway Package Documentation - forc.pub',
  },
  description: 'Auto-generated documentation for Sway packages published on forc.pub',
};

interface DocsLayoutProps {
  children: React.ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Button
            component={Link}
            href="/"
            startIcon={<HomeIcon />}
            color="inherit"
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              textTransform: 'none'
            }}
          >
            forc.pub
          </Button>
        </Toolbar>
      </AppBar>
      
      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>
    </Box>
  );
}