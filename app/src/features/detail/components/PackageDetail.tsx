import React, { useState } from "react";
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
} from "@mui/material";
import { useParams } from "react-router-dom";

const PackageDetail: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const [activeTab, setActiveTab] = useState(0);

  // Simulate version data
  const versionCount: number = 2; // Example: Replace with dynamic fetch or prop

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="md" style={{ marginTop: "24px", maxWidth: "830px" }}>
      <Typography
        variant="h4"
        gutterBottom
        style={{ textAlign: "center", marginBottom: "16px", fontWeight: "bold" }}
      >
        Package: {name}
      </Typography>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        centered
        style={{ marginBottom: "24px" }}
      >
        <Tab label="Readme" />
        <Tab label={`${versionCount} ${versionCount === 1 ? "Version" : "Versions"}`} />
      </Tabs>
      <Grid container spacing={4}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Box>
            {activeTab === 0 && (
              <Card
                variant="outlined"
                style={{
                  marginBottom: "16px",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                }}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    style={{ fontWeight: "600", color: "#1976d2" }}
                  >
                    Readme
                  </Typography>
                  <Typography>
                    The readme content for the package "{name}" will be shown here, giving users
                    an insight into the package's purpose and usage.
                  </Typography>
                </CardContent>
              </Card>
            )}
            {activeTab === 1 && (
              <Card
                variant="outlined"
                style={{
                  marginBottom: "16px",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                }}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    style={{ fontWeight: "600", color: "#1976d2" }}
                  >
                    Versions
                  </Typography>
                  <Typography>
                    A list of all versions for the package "{name}" will be displayed here, along
                    with their release dates and changelogs.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Box>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Box style={{ marginTop: "24px" }}>
            <Card
              variant="outlined"
              style={{
                marginBottom: "16px",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  style={{ fontWeight: "600", color: "#1976d2" }}
                >
                  Maintainers
                </Typography>
                <Typography>
                  A list of maintainers for the package will be displayed here, including their
                  contact information or profiles.
                </Typography>
              </CardContent>
            </Card>
            <Card
              variant="outlined"
              style={{
                marginBottom: "16px",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  style={{ fontWeight: "600", color: "#1976d2" }}
                >
                  Links
                </Typography>
                <Typography>
                  Repository: <a href="https://github.com/">https://github.com/</a>
                </Typography>
                <Typography>
                  Documentation: <a href="https://github.com/">https://github.com/</a>
                </Typography>
                <Typography>
                  Homepage: <a href="https://github.com/">https://github.com/</a>
                </Typography>
              </CardContent>
            </Card>
            <Card
              variant="outlined"
              style={{
                marginBottom: "16px",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  style={{ fontWeight: "600", color: "#1976d2" }}
                >
                  Downloads
                </Typography>
                <Typography>
                  Total Downloads: 123,456
                </Typography>
                <Typography>
                  Weekly Downloads: 1,234
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default PackageDetail;
