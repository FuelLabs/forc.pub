"use client";

import { Suspense } from "react";
import App from "../App";
import Home from "../pages/Home";

export default function Page() {
  return (
    <App>
      <Suspense fallback={<div>Loading...</div>}>
        <Home />
      </Suspense>
    </App>
  );
}
