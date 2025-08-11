import React from "react";
import { Box, AppBar, Toolbar, Typography, Button } from "@mui/material";
import Link from "next/link";
import DescriptionIcon from "@mui/icons-material/Description";
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
          <Box display="flex" alignItems="center" sx={{ flexGrow: 1 }}>
            <DescriptionIcon sx={{ mr: 1 }} />
            <Typography variant="h6" component={Link} href="/docs" sx={{ 
              textDecoration: 'none', 
              color: 'inherit',
              mr: 2
            }}>
              Sway Docs
            </Typography>
            <Button
              component={Link}
              href="/"
              startIcon={<HomeIcon />}
              color="inherit"
              sx={{ ml: 'auto' }}
            >
              forc.pub
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>
    </Box>
  );
}