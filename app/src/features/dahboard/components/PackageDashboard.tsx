import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Container,
} from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useNavigate } from 'react-router-dom';

type Package = {
  id: string;
  packageName: string;
  version: string;
  description: string;
  repository: string;
  updatedAt?: string;
  createdAt?: string;
};

type PackageData = { justUpdated: Package[]; newPackages: Package[] };

// Example API fetch function (replace with your actual API call)
const fetchPackages = async (): Promise<PackageData> => {
  return {
    justUpdated: [
      {
        id: '1',
        packageName: 'example-package',
        version: '1.0.1',
        description: 'An example package with a recent update.',
        repository: 'https://github.com/example/example-package',
        updatedAt: '2025-01-10T15:34:56Z',
      },
      {
        id: '2',
        packageName: 'another-package',
        version: '2.1.0',
        description: 'Another package with cool features recently updated.',
        repository: 'https://github.com/example/another-package',
        updatedAt: '2025-01-09T12:20:30Z',
      },
    ],
    newPackages: [
      {
        id: '3',
        packageName: 'new-package',
        version: '1.0.0',
        description: 'A brand new package for demonstration purposes.',
        repository: 'https://github.com/example/new-package',
        createdAt: '2025-01-10T10:00:00Z',
      },
      {
        id: '4',
        packageName: 'cool-package',
        version: '0.1.0',
        description: 'A cool new package to explore.',
        repository: 'https://github.com/example/cool-package',
        createdAt: '2025-01-09T18:45:30Z',
      },
    ],
  };
};

const PackageDashboard: React.FC = () => {
  const [data, setData] = useState<PackageData>({
    justUpdated: [],
    newPackages: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadPackages = async () => {
      try {
        const result = await fetchPackages();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch packages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPackages();
  }, []);

  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        minHeight='100vh'>
        <CircularProgress />
      </Box>
    );
  }

  const renderPackages = (packages: Package[], type: string) => (
    <>
      <Typography
        variant='h5'
        gutterBottom
        style={{ borderBottom: '2px solid #1976d2', paddingBottom: '8px' }}>
        {type}
      </Typography>
      {packages.map((pkg) => (
        <Card
          key={pkg.id}
          style={{
            marginBottom: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s, background-color 0.2s',
          }}
          onClick={() => navigate('/package/' + pkg.packageName)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = '#f0f8ff')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'white')
          }>
          <CardContent style={{ display: 'flex', alignItems: 'center' }}>
            <Box flex={1}>
              <Typography variant='h6' gutterBottom>
                {pkg.packageName} (v{pkg.version})
              </Typography>
              <Typography variant='body2' color='textSecondary' gutterBottom>
                {type === 'Just Updated'
                  ? `Updated: ${new Date(pkg.updatedAt!).toLocaleString()}`
                  : `Added: ${new Date(pkg.createdAt!).toLocaleString()}`}
              </Typography>
              <Typography variant='body1' paragraph>
                {pkg.description || 'No description available.'}
              </Typography>
            </Box>
            <ArrowForwardIosIcon color='action' />
          </CardContent>
        </Card>
      ))}
    </>
  );

  return (
    <Container maxWidth='md' style={{ marginTop: '24px' }}>
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          {renderPackages(data.justUpdated, 'Just Updated')}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderPackages(data.newPackages, 'New Packages')}
        </Grid>
      </Grid>
    </Container>
  );
};

export default PackageDashboard;
