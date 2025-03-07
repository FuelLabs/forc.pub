import React, { useCallback } from "react";
import Lock from "@mui/icons-material/Lock";
import Button from "@mui/material/Button/Button";
import styled from "@emotion/styled";
import Menu from "@mui/material/Menu/Menu";
import MenuItem from "@mui/material/MenuItem/MenuItem";
import { useNavigate } from "react-router-dom";
import { useGithubAuth } from "../hooks/useGithubAuth";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { REDIRECT_URI } from "../../../constants";
import "./UserButton.css";

export const GITHUB_CLIENT_ID = "Iv1.ebdf596c6c548759";

const StyledWrapper = styled.div`
  text-wrap: nowrap;
  color: inherit;
`;

function UserButton() {
  const navigate = useNavigate();
  const [user, logout] = useGithubAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    },
    [setAnchorEl],
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, [setAnchorEl]);

  const handleNavigate = useCallback(
    (route: string) => {
      handleClose();
      navigate(route);
    },
    [handleClose, navigate],
  );

  const handleLogout = useCallback(() => {
    logout();
    handleNavigate("/");
  }, [handleNavigate, logout]);

  if (user) {
    return (
      <StyledWrapper>
        <Button
          color="inherit"
          onClick={handleMenu}
          endIcon={<ArrowDropDownIcon />}
          className="user-button"
        >
          <img
            src={user.avatarUrl}
            title={user.fullName}
            alt={user.githubLogin}
            className="user-avatar"
          />
          <div className="user-name">{user.fullName}</div>
        </Button>
        <Menu
          anchorEl={anchorEl}
          keepMounted
          open={Boolean(anchorEl)}
          onClose={handleClose}
          className="user-menu"
          classes={{
            paper: "menu-paper",
          }}
          PaperProps={{
            className: "menu-paper",
          }}
        >
          <MenuItem
            key="tokens"
            onClick={() => handleNavigate("/tokens")}
            className="menu-item"
          >
            API Tokens
          </MenuItem>
          <MenuItem key="logout" onClick={handleLogout} className="menu-item">
            Log Out
          </MenuItem>
        </Menu>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper>
      <Button
        color="inherit"
        className="login-button"
        onClick={() => {
          const width = 800;
          const height = 1000;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          const windowDimensions = [
            `width=${width}`,
            `height=${height}`,
            `left=${left}`,
            `top=${top}`,
            "toolbar=0",
            "scrollbars=1",
            "status=1",
            "resizable=1",
            "location=1",
            "menuBar=0",
          ].join(",");

          window.open(
            `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}`,
            undefined,
            windowDimensions,
          );
        }}
      >
        <>
          <Lock className="login-icon" />
          <div className="login-text">Log in with GitHub</div>
        </>
      </Button>
    </StyledWrapper>
  );
}

export default UserButton;
