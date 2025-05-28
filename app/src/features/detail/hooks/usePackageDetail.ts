"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import HTTP from "../../../utils/http";

export interface FullPackage {
  name: string;
  version: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  bytecodeIdentifier: string | null;
  forcVersion: string;
  sourceCodeIpfsUrl: string;
  abiIpfsUrl: string | null;
  repository: string | null;
  documentation: string | null;
  homepage: string | null;
  urls: string[];
  readme: string | null;
  license: string | null;
}

const usePackageDetail = (packageName: string, version?: string) => {
  const [data, setData] = useState<FullPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!packageName) {
      setError("Package name is required");
      setLoading(false);
      return;
    }

    const params = { name: packageName };
    if (version) {
      Object.assign(params, { version });
    }

    HTTP.get("/package", { params })
      .then(({ data }) => {
        setData(data);
      })
      .catch((err: Error) =>
        setError(
          axios.isAxiosError(err)
            ? err.response?.data?.message || "Failed to load package details"
            : "An unknown error occurred",
        ),
      )
      .finally(() => setLoading(false));
  }, [packageName, version]);

  return { data, error, loading };
};

export default usePackageDetail;
