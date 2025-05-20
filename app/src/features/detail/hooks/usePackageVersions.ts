import { useCallback, useEffect, useState } from "react";
import HTTP, { PackageVersionInfo } from "../../../utils/http";

export function usePackageVersions(packageName: string) {
  const [versions, setVersions] = useState<PackageVersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await HTTP.get("/package/versions", {
        params: { name: packageName },
      });
      setVersions(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch package versions",
      );
    } finally {
      setLoading(false);
    }
  }, [packageName]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return { versions, loading, error };
}

export default usePackageVersions;
