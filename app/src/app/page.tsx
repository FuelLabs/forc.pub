"use client";

import App from "../App";
import PackageDashboard from "../features/dashboard/components/PackageDashboard";

export default function HomePage() {
  return (
    <App>
      <div>
        <h1>{"The Sway community's package registry"}</h1>
        <PackageDashboard />
      </div>
    </App>
  );
}
