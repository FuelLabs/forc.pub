import React from 'react';
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
import useFetchRecentPackages, {
  RecentPackage,
} from '../hooks/useFetchRecentPackages';

const PackageDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading } = useFetchRecentPackages();

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

  const renderPackages = (packages: RecentPackage[], type: string) => (
    <>
      <Typography
        variant='h5'
        gutterBottom
        style={{ borderBottom: '2px solid #1976d2', paddingBottom: '8px' }}>
        {type}
      </Typography>
      {packages.map((pkg, i) => (
        <Card
          key={i}
          style={{
            marginBottom: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s, background-color 0.2s',
          }}
          onClick={() => navigate('/package/' + pkg.name)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = '#f0f8ff')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'white')
          }>
          <CardContent style={{ display: 'flex', alignItems: 'center' }}>
            <Box flex={1}>
              <Typography variant='h6' gutterBottom>
                {pkg.name} (v{pkg.version})
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
          {renderPackages(data.recentlyUpdated, 'Just Updated')}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderPackages(data.recentlyCreated, 'New Packages')}
        </Grid>
      </Grid>
    </Container>
  );
};

export default PackageDashboard;
