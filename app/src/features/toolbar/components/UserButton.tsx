"use client";

import React, { useCallback, useState } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useGithubAuth } from "../hooks/useGithubAuth";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { REDIRECT_URI } from "../../../constants";
import "./UserButton.css";
import { useRouter } from "next/navigation";
import Image from "next/image";
import GitHubIcon from "@mui/icons-material/GitHub";

export const GITHUB_CLIENT_ID = "Iv1.ebdf596c6c548759";

function UserButton() {
  const router = useRouter();
  const [user, logout] = useGithubAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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
      router.push(route);
    },
    [handleClose, router],
  );

  const handleLogout = useCallback(() => {
    logout();
    handleNavigate("/");
  }, [handleNavigate, logout]);

  if (user) {
    return (
      <div className="button-wrapper">
        <Button
          color="inherit"
          onClick={handleMenu}
          endIcon={<ArrowDropDownIcon />}
          className="user-button"
        >
          {user.avatarUrl && (
            <Image
              width={32}
              height={32}
              src={user.avatarUrl}
              title={user.fullName}
              alt={user.githubLogin}
              className="user-avatar"
            />
          )}
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
          <MenuItem
            key="logout"
            onClick={handleLogout}
            className="menu-item"
          >
            Log Out
          </MenuItem>
        </Menu>
      </div>
    );
  }

  return (
    <div className="button-wrapper">
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
        sx={{
          border: '1px solid #333',
          borderRadius: 1,
          color: '#fff',
          fontWeight: 600,
          px: 2.5,
        }}
      >
        <>
          <GitHubIcon className="login-icon" />
          <div className="login-text">Log in with GitHub</div>
        </>
      </Button>
    </div>
  );
}

export default UserButton;
