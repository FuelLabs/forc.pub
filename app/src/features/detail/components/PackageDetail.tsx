"use client";

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
  CircularProgress,
  Alert,
  Link,
  Button,
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";

import usePackageDetail from "../hooks/usePackageDetail";
import ReactMarkdown from "react-markdown";
import "./PackageDetail.css";
import PackageSidebar from "./PackageSidebar";
import { AbiContent } from "./AbiContent";

type TabNames =
  | "Readme"
  | "Versions"
  | "Dependencies"
  | "Dependents"
  | "Code"
  | "ABI";
const TABS: TabNames[] = [
  "Readme",
  "Versions",
  "Dependencies",
  "Dependents",
  "Code",
  "ABI",
];

interface PackageDetailProps {
  packageName: string;
}

const PackageDetail: React.FC<PackageDetailProps> = ({ packageName }) => {
  const [activeTab, setActiveTab] = useState<TabNames>(TABS[0]);
  const { data, loading, error } = usePackageDetail(packageName);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(TABS[newValue]);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ margin: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ margin: 4 }}>
        <Alert severity="info">No package information found.</Alert>
      </Box>
    );
  }

  const renderReadmeTab = () => (
    <Card variant="outlined" className="card-dark">
      <CardContent className="card-content">
        {data.readme ? (
          <div className="readme-content">
            <ReactMarkdown>{data.readme}</ReactMarkdown>
          </div>
        ) : (
          <Typography>No readme available for this package.</Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="package-detail-container">
      <Container maxWidth="lg" className="package-detail-inner">
        <div className="package-header">
          <Typography variant="h4" gutterBottom className="package-title">
            {data.name}@{data.version}
          </Typography>
          {data.description && (
            <Typography
              variant="body1"
              className="package-description-text-header"
            >
              {data.description}
            </Typography>
          )}
        </div>
        <Tabs
          value={TABS.indexOf(activeTab)}
          onChange={handleTabChange}
          indicatorColor="secondary"
          textColor="inherit"
          centered
          className="package-tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Readme" className="package-tab" />
          <Tab label="Versions" className="package-tab" />
          <Tab label="Dependencies" className="package-tab" />
          <Tab label="Dependents" className="package-tab" />
          <Tab label="Code" className="package-tab" />
          {data.abiIpfsUrl && <Tab label="ABI" className="package-tab" />}
        </Tabs>

        <Grid container spacing={4}>
          {/* Main Content - Left Side (changes with tabs) */}
          <Grid item xs={12} md={7} lg={8}>
            {/* Readme Tab */}
            {activeTab === TABS[0] && renderReadmeTab()}

            {/* Versions Tab */}
            {activeTab === TABS[1] && (
              <Card variant="outlined" className="card-dark">
                <CardContent className="card-content">
                  <Typography variant="h6" gutterBottom className="card-title">
                    Version History
                  </Typography>
                  <div className="tab-content">
                    <Typography paragraph>
                      Version history for this package will be displayed here.
                    </Typography>
                    <Alert severity="info" className="alert-dark">
                      Version history feature is coming soon.
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dependencies Tab */}
            {activeTab === TABS[2] && (
              <Card variant="outlined" className="card-dark">
                <CardContent className="card-content">
                  <Typography variant="h6" gutterBottom className="card-title">
                    Dependencies
                  </Typography>
                  <div className="tab-content">
                    <Typography paragraph>
                      Packages that this package depends on will be displayed
                      here.
                    </Typography>
                    <Alert severity="info" className="alert-dark">
                      Dependencies feature is coming soon.
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dependents Tab */}
            {activeTab === TABS[3] && (
              <Card variant="outlined" className="card-dark">
                <CardContent className="card-content">
                  <Typography variant="h6" gutterBottom className="card-title">
                    Dependents
                  </Typography>
                  <div className="tab-content">
                    <Typography paragraph>
                      Packages that depend on this package will be displayed
                      here.
                    </Typography>
                    <Alert severity="info" className="alert-dark">
                      Dependents feature is coming soon.
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Code Tab */}
            {activeTab === TABS[4] && (
              <Card variant="outlined" className="card-dark">
                <CardContent className="card-content">
                  <Typography variant="h6" gutterBottom className="card-title">
                    Source Code
                  </Typography>
                  <div className="tab-content">
                    <div className="download-section">
                      <Link
                        href={data.sourceCodeIpfsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <Button
                          variant="contained"
                          color="secondary"
                          startIcon={<CloudDownloadIcon />}
                        >
                          Download Source Package (.tgz)
                        </Button>
                      </Link>

                      <Typography variant="body2" className="download-info">
                        Package source code
                      </Typography>

                      <Typography variant="caption" className="ipfs-hash">
                        IPFS: {data.sourceCodeIpfsUrl.split("/").pop()}
                      </Typography>
                    </div>

                    <Alert severity="info" className="alert-dark">
                      Source code browser feature is coming soon.
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* ABI Tab */}
            {activeTab === TABS[5] && (
              <Card variant="outlined" className="card-dark">
                <CardContent className="card-content">
                  <Typography variant="h6" gutterBottom className="card-title">
                    Application Binary Interface (ABI)
                  </Typography>

                  {data.abiIpfsUrl && (
                    <>
                      <div className="tab-content">
                        <div className="abi-download">
                          <Link
                            href={data.abiIpfsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-light"
                          >
                            <Button
                              variant="contained"
                              color="secondary"
                              startIcon={<CloudDownloadIcon />}
                            >
                              Download ABI (.json)
                            </Button>
                          </Link>
                        </div>
                        <AbiContent
                          abiUrl={`${data.abiIpfsUrl}?filename=${data.name}-abi.json.&download=true`}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Sidebar - Right Side (always visible) */}
          <Grid item xs={12} md={5} lg={4}>
            <PackageSidebar data={data} loading={loading} error={error} />
          </Grid>
        </Grid>
      </Container>
    </div>
  );
};

export default PackageDetail;
