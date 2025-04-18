"use client";

import { Suspense } from "react";
import App from "../../App";
import ApiTokens from "../../pages/ApiTokens";

export default function TokensPage() {
  return (
    <App>
      <Suspense fallback={<div>Loading...</div>}>
        <ApiTokens />
      </Suspense>
    </App>
  );
}
