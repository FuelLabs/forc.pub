import React from 'react';
import AppBar from '@mui/material/AppBar/AppBar';
import Toolbar from '@mui/material/Toolbar/Toolbar';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import Input from '@mui/material/Input/Input';
import IconButton from '@mui/material/IconButton/IconButton';
import Box from '@mui/material/Box/Box';
import AccountCircle from '@mui/icons-material/AccountCircle';
import InputAdornment from '@mui/material/InputAdornment/InputAdornment';

export const FUEL_GREEN = '#00f58c';

function App() {
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
        <Toolbar style={{ backgroundColor: 'black' }}>
          <IconButton
            size='large'
            edge='start'
            color='inherit'
            aria-label='open drawer'
            sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <div
            style={{
              flexGrow: 1,
              display: 'block',
              color: FUEL_GREEN,
              fontSize: '24px',
              fontFamily: 'monospace',
            }}>
            forc.pub
          </div>

          <div
            style={{
              marginLeft: '20px',
              marginRight: '10px',
              height: '70%',
              width: '100%',
            }}>
            <Input
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'lightGrey',
              }}
              startAdornment={
                <InputAdornment position='start' style={{ marginLeft: '10px' }}>
                  <SearchIcon />
                </InputAdornment>
              }
              placeholder='Search packages and plugins'
              inputProps={{ 'aria-label': 'search' }}
            />
          </div>
          <IconButton
            size='large'
            edge='end'
            aria-label='account of current user'
            aria-haspopup='true'
            onClick={() => {}}
            color='inherit'>
            <AccountCircle />
          </IconButton>
        </Toolbar>
      </AppBar>

      <div style={{ width: '100%' }}>
        <h1>{"The Sway community's package registry"}</h1>
      </div>
      <div style={{ color: 'red' }}>{'Under construction'}</div>
    </div>
  );
}

export default App;
