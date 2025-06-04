"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import App from "../App";
import PackageDashboard from "../features/dashboard/components/PackageDashboard";
import SearchResultsWrapper from "../pages/SearchResults";

function HomePage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim();

  return (
    <App>
      <div>
        {query ? (
          <SearchResultsWrapper />
        ) : (
          <>
            <h1>{"The Sway community's package registry"}</h1>
            <PackageDashboard />
          </>
        )}
      </div>
    </App>
  );
}

export default function HomePageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePage />
    </Suspense>
  );
}
