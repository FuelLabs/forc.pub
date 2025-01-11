import { useState, useEffect } from 'react';
import axios from 'axios';
import HTTP from '../../../utils/http';

export interface RecentPackage {
  name: string;
  version: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecentPackagesResponse {
  recently_updated: RecentPackage[];
  recently_created: RecentPackage[];
}

const useFetchRecentPackages = () => {
  const [data, setData] = useState<RecentPackagesResponse>({
    recently_updated: [],
    recently_created: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    HTTP.get(`/recent_packages`)
      .then(({ data }) => {
        setData(data);
      })
      .catch((err: any) =>
        setError(
          axios.isAxiosError(err)
            ? err.response?.data?.message || 'An error occurred'
            : 'An unknown error occurred'
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return { data, error, loading };
};

export default useFetchRecentPackages;
