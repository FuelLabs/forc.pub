"use client";

import { Suspense } from "react";
import App from "../../App";
import SearchResults from "../../pages/SearchResults";

export default function SearchPage() {
  return (
    <App>
      <Suspense fallback={<div>Loading...</div>}>
        <SearchResults />
      </Suspense>
    </App>
  );
}
