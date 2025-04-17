import { useState, useEffect } from "react";

interface UseAbiContentResult {
  abiContent: any;
  loading: boolean;
  error: Error | null;
}

export const useAbiContent = (abiUrl: string | null): UseAbiContentResult => {
  const [abiContent, setAbiContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAbi = async () => {
      if (!abiUrl) return;

      setLoading(true);
      try {
        const response = await fetch(abiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAbiContent(data);
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Failed to fetch ABI"));
      } finally {
        setLoading(false);
      }
    };

    fetchAbi();
  }, [abiUrl]);

  return { abiContent, loading, error };
};
