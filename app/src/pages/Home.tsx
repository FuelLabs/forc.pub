import React from 'react';
import PackageDashboard from '../features/dahboard/components/PackageDashboard';

function Home() {
  return (
    <div>
      <div style={{ width: '100%' }}>
        <h1>{"The Sway community's package registry"}</h1>
      </div>
      <PackageDashboard />
    </div>
  );
}

export default Home;
