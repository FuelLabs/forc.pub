"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Box, 
  Typography, 
  Container, 
  Button, 
  Stack,
  Paper,
  useTheme
} from "@mui/material";
import { 
  Download as DownloadIcon, 
  Rocket as RocketIcon,
  Code as CodeIcon 
} from "@mui/icons-material";
import App from "../App";
import PackageDashboard from "../features/dashboard/components/PackageDashboard";
import SearchResultsWrapper from "../pages/SearchResults";

function HomePage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim();
  const theme = useTheme();

  const HeroSection = () => (
      
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, px: { xs: 4, md: 6 }, py: { xs: 4, md: 6 } }}>
        <Box textAlign="center" mb={6}>
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 800,
              fontSize: { xs: '2.4rem', md: '3.5rem' },
              color: '#ffffff',
              mb: 2,
            }}
          >
            The Sway Package Registry
          </Typography>
          
          <Typography
            variant="h5"
            component="h2"
            color="text.secondary"
            sx={{
              maxWidth: '600px',
              mx: 'auto',
              mb: 4,
              fontWeight: 400,
              lineHeight: 1.4,
              fontSize: { xs: '1rem', md: '1.2rem' },
            }}
          >
            Instantly publish your packages and install them. Use the API to interact 
            and find out more information about available packages.
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
            alignItems="center"
          >
            <a
              href="https://docs.fuel.network/guides/installation/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<DownloadIcon />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                  '&:hover': {
                    background: `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 25px ${theme.palette.primary.main}40`,
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Install Forc
              </Button>
            </a>
            
            <a
              href="https://docs.fuel.network/docs/sway/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <Button
                variant="outlined"
                size="large"
                startIcon={<RocketIcon />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    borderColor: theme.palette.primary.light,
                    color: theme.palette.primary.light,
                    backgroundColor: `${theme.palette.primary.main}10`,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Getting Started
              </Button>
            </a>
          </Stack>
        </Box>

        {/* Feature highlights */}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          justifyContent="center"
          alignItems="stretch"
        >
          {[
            {
              icon: <CodeIcon />,
              title: 'Easy Publishing',
              description: 'Publish your Sway packages with a single command'
            },
            {
              icon: <DownloadIcon />,
              title: 'Fast Installation',
              description: 'Install packages quickly and manage dependencies'
            },
            {
              icon: <RocketIcon />,
              title: 'Community Driven',
              description: 'Built by and for the Sway developer community'
            }
          ].map((feature, index) => (
            <Paper
              key={index}
              elevation={0}
              sx={{
                p: 3,
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  color: theme.palette.primary.main,
                  mb: 2,
                  '& svg': { fontSize: '2rem' }
                }}
              >
                {feature.icon}
              </Box>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                {feature.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {feature.description}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Container>
  );

  return (
    <App>
      <Box>
        {query ? (
          <SearchResultsWrapper />
        ) : (
          <>
            <HeroSection />
            <Container maxWidth="lg">
              <PackageDashboard />
            </Container>
          </>
        )}
      </Box>
    </App>
  );
}

export default function HomePageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePage />
    </Suspense>
  );
}
