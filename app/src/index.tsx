import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import ApiTokens from "./pages/ApiTokens";
import SearchResults from "./pages/SearchResults";
import PackageDetail from "./features/detail/components/PackageDetail";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <App>
        <Home />
      </App>
    ),
  },
  {
    path: "/tokens",
    element: (
      <App>
        <ApiTokens />
      </App>
    ),
  },
  {
    path: "/search",
    element: (
      <App>
        <SearchResults />
      </App>
    ),
  },
  {
    path: "/package/:name",
    element: (
      <App>
        <PackageDetail />
      </App>
    ),
  },
]);

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
