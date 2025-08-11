import React from "react";
import DocsSearch from "../../features/docs/components/DocsSearch";

export const metadata = {
  title: "Sway Package Documentation - forc.pub",
  description: "Browse and search auto-generated documentation for Sway packages published on forc.pub",
};

export default function DocsHomePage() {
  return <DocsSearch />;
}