import React, { ReactNode } from 'react';
import AppBar from '@mui/material/AppBar/AppBar';
import Toolbar from '@mui/material/Toolbar/Toolbar';
import { useNavigate } from 'react-router-dom';
import UserButton from './features/toolbar/components/UserButton';
import { useIsMobile } from './features/toolbar/hooks/useIsMobile';
import SearchBar from './features/toolbar/components/SearchBar';

export const FUEL_GREEN = '#00f58c';

interface AppProps {
  children?: ReactNode;
}

function App({children}: AppProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'center',
        backgroundColor: 'lightGrey',
        height: '100vh',
      }}>
      <AppBar position='static'>
        <Toolbar style={{ backgroundColor: '#181818' }}>
          <div
            style={{
              flexGrow: 1,
              display: 'block',
              color: FUEL_GREEN,
              fontSize: '24px',
              fontFamily: 'monospace',
              cursor: 'pointer'
            }} onClick={()=>navigate('/')}>
            forc.pub
          </div>

          {!isMobile && <SearchBar />}
          <UserButton />
        </Toolbar>
        {isMobile && <SearchBar />}
      </AppBar>
      {children}
    </div>
  );
}

export default App;
