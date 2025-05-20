"use client";

import React from "react";
import PackageDetail from "../../../../features/detail/components/PackageDetail";
import App from "../../../../App";

interface PackagePageProps {
  params: {
    name: string;
    version: string;
  };
}

export default function PackagePage({ params }: PackagePageProps) {
  return (
    <App>
      <PackageDetail packageName={params.name} version={params.version} />
    </App>
  );
}
