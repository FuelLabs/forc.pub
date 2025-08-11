import React from "react";
import { Container, Typography, Button, Box, Alert } from "@mui/material";
import Link from "next/link";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

export const metadata = {
  title: "Documentation Not Found - forc.pub",
  description: "The requested documentation could not be found.",
};

export default function DocsNotFound() {
  return (
    <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
      <Box mb={4}>
        <DescriptionOutlinedIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h3" component="h1" gutterBottom>
          Documentation Not Found
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          The documentation you&apos;re looking for doesn&apos;t exist or is not available.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 4, textAlign: 'left' }}>
        This could happen if:
        <Box component="ul" sx={{ mt: 1, mb: 0 }}>
          <li>The package doesn&apos;t have auto-generated documentation</li>
          <li>The package version doesn&apos;t exist</li>
          <li>The documentation files are not available on IPFS</li>
          <li>There was a temporary network issue</li>
        </Box>
      </Alert>

      <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
        <Button 
          variant="contained" 
          color="primary"
          component={Link}
          href="/docs"
          size="large"
        >
          Browse All Documentation
        </Button>
        <Button 
          variant="outlined" 
          color="primary"
          component={Link}
          href="/"
          size="large"
        >
          Back to forc.pub
        </Button>
      </Box>
    </Container>
  );
}