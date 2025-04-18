"use client";

import App from "../../../App";
import PackageDetail from "../../../features/detail/components/PackageDetail";
import { useParams } from "next/navigation";

export default function PackagePage() {
  const params = useParams();
  const name = params.name as string;

  return (
    <App>
      {" "}
      <PackageDetail packageName={name} />{" "}
    </App>
  );
}
