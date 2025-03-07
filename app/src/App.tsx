import React, { ReactNode } from "react";
import AppBar from "@mui/material/AppBar/AppBar";
import Toolbar from "@mui/material/Toolbar/Toolbar";
import { useNavigate } from "react-router-dom";
import UserButton from "./features/toolbar/components/UserButton";
import { useIsMobile } from "./features/toolbar/hooks/useIsMobile";
import SearchBar from "./features/toolbar/components/SearchBar";
import "./App.css";

export const FUEL_GREEN = "#00f58c";

interface AppProps {
  children?: ReactNode;
}

function App({ children }: AppProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div className="app-container">
      <AppBar position="static">
        <Toolbar className="app-toolbar">
          <div className="app-logo" onClick={() => navigate("/")}>
            forc.pub
          </div>

          {!isMobile && <SearchBar />}
          <UserButton />
        </Toolbar>
        {isMobile && <SearchBar />}
      </AppBar>
      <div className="app-content">{children}</div>
    </div>
  );
}

export default App;
