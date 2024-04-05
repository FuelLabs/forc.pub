import React, { useCallback } from 'react';
import Lock from '@mui/icons-material/Lock';
import Button from '@mui/material/Button/Button';
import styled from '@emotion/styled';
import Menu from '@mui/material/Menu/Menu';
import MenuItem from '@mui/material/MenuItem/MenuItem';
import {  useNavigate } from 'react-router-dom';
import { useGithubAuth } from '../hooks/useGithubAuth';
import { useLocalSession } from '../../../utils/localStorage';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

export const GITHUB_CLIENT_ID = 'Iv1.ebdf596c6c548759';

const StyledWrapper = styled.div`
  text-wrap: nowrap;
  color: inherit;
`;

function UserButton() {
  const { clearSessionId, sessionId } = useLocalSession();
  const navigate = useNavigate();
  const [user, logout] = useGithubAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    },
    [setAnchorEl]
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, [setAnchorEl]);

  const handleNavigate = useCallback(
    (route: string) => {
      handleClose();
      navigate(route);
    },
    [handleClose, navigate]
  );

  const handleLogout = useCallback(() => {
    clearSessionId();
    logout();
    handleNavigate('/');
  }, [handleNavigate, logout, clearSessionId]);

  if (user && sessionId) {
    return (
      <StyledWrapper>
        <Button color='inherit' onClick={handleMenu} endIcon={<ArrowDropDownIcon />}>
          <img
            src={user.avatar_url}
            title={user.name}
            alt={`${user.name} (TODO: login)`}
            style={{ height: '30px', width: '30px', borderRadius: '50%' }}
          />
          <div style={{ marginLeft: '10px' }}>{user.name}</div>
        </Button>
        <Menu
          anchorEl={anchorEl}
          keepMounted
          open={Boolean(anchorEl)}
          onClose={handleClose}>
          <MenuItem key='profile' onClick={() => handleNavigate('/settings')}>
            Account Settings
          </MenuItem>
          <MenuItem key='account' onClick={handleLogout}>
            Log Out
          </MenuItem>
        </Menu>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper>
      <Button
        color='inherit'
        onClick={() => {
          const width = 800;
          const height = 1000;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          let windowDimensions = [
            `width=${width}`,
            `height=${height}`,
            `left=${left}`,
            `top=${top}`,
            'toolbar=0',
            'scrollbars=1',
            'status=1',
            'resizable=1',
            'location=1',
            'menuBar=0',
          ].join(',');

          window.open(
            `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}`,
            undefined,
            windowDimensions
          );
        }}>
        <>
          <Lock />
          <div style={{ marginLeft: '10px' }}>Log in with GitHub</div>
        </>
      </Button>
    </StyledWrapper>
  );
}

export default UserButton;
