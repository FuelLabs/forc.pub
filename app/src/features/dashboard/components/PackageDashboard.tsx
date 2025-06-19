"use client";

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Container,
} from "@mui/material";
import useFetchRecentPackages, {
  RecentPackage,
} from "../hooks/useFetchRecentPackages";
import "./PackageDashboard.css";
import { useRouter } from "next/navigation";

const PackageDashboard: React.FC = () => {
  const router = useRouter();
  const { data, loading } = useFetchRecentPackages();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  const renderPackages = (packages: RecentPackage[], type: string) => (
    <>
      <Typography variant="h5" gutterBottom className="section-title">
        {type}
      </Typography>
      {packages.map((pkg, i) => (
        <Card
          key={i}
          className="package-card"
          onClick={() => router.push("/package/" + pkg.name)}
          onMouseEnter={(e) =>
            (e.currentTarget.className = "package-card package-card-hover")
          }
          onMouseLeave={(e) => (e.currentTarget.className = "package-card")}
        >
          <CardContent className="card-content">
            <Box flex={1}>
              <Typography variant="h6" gutterBottom className="package-name">
                {pkg.name} (v{pkg.version})
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
                className="package-timestamp"
              >
                {type === "Just Updated"
                  ? `Updated: ${new Date(pkg.updatedAt!).toLocaleString()}`
                  : `Added: ${new Date(pkg.createdAt!).toLocaleString()}`}
              </Typography>
              <Typography
                variant="body1"
                paragraph
                className="package-description"
              >
                {pkg.description || "No description available."}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </>
  );

  return (
    <Container maxWidth="lg" className="dashboard-container">
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          {renderPackages(data.recentlyUpdated, "Just Updated")}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderPackages(data.recentlyCreated, "New Packages")}
        </Grid>
      </Grid>
    </Container>
  );
};

export default PackageDashboard;
