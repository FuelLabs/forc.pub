import React from "react";
import PackageDashboard from "../features/dahboard/components/PackageDashboard";
import "./Home.css";

function Home() {
  return (
    <div className="home-container">
      <div className="home-header">
        <h1 className="home-title">
          {"The Sway community's package registry"}
        </h1>
      </div>
      <PackageDashboard />
    </div>
  );
}

export default Home;
