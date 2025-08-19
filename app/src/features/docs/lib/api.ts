import HTTP, { PackagePreview } from "../../../utils/http";
import { RecentPackage, RecentPackagesResponse as APIRecentPackagesResponse } from "../../dashboard/hooks/useFetchRecentPackages";

// API pagination constants
const DEFAULT_PAGE = "1";
const MAX_SEARCH_RESULTS = "100";

export interface PackageWithDocs {
  name: string;
  version: string;
  description: string | null;
  docsIpfsUrl: string | null;
}

export interface PackageSearchResult {
  name: string;
  version: string;
  description: string | null;
  categories: string[];
  keywords: string[];
  docsIpfsUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecentPackagesResponse {
  recentlyCreated: PackageSearchResult[];
  recentlyUpdated: PackageSearchResult[];
}

/// Generic API call wrapper with consistent error handling
async function apiCall<T>(endpoint: string, params: Record<string, string>, errorMessage: string): Promise<T> {
  try {
    const response = await HTTP.get(endpoint, { params });
    return response.data;
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, { params, error });
    throw new Error(errorMessage);
  }
}

export async function getPackageDetail(name: string, version: string): Promise<PackageWithDocs> {
  const data = await apiCall('/package', { name, version }, `Failed to fetch package details for ${name}@${version}`);
  
  return {
    name: data.name,
    version: data.version,
    description: data.description,
    docsIpfsUrl: data.docsIpfsUrl
  };
}

export async function getLatestVersion(name: string): Promise<string> {
  const data = await apiCall('/package', { name }, `Failed to fetch latest version for ${name}`);
  return data.version;
}

export async function searchPackages(query: string): Promise<PackageSearchResult[]> {
  try {
    const data = await apiCall('/search', { 
      q: query,
      page: DEFAULT_PAGE,
      per_page: MAX_SEARCH_RESULTS
    }, 'Search failed');
    
    return data.data.map((pkg: PackagePreview) => ({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      categories: pkg.categories,
      keywords: pkg.keywords,
      docsIpfsUrl: pkg.docsIpfsUrl
    }));
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

export async function getRecentPackages(): Promise<RecentPackagesResponse> {
  try {
    const data: APIRecentPackagesResponse = await apiCall('/recent_packages', {}, 'Failed to fetch recent packages');
    
    const mapPackage = (pkg: RecentPackage): PackageSearchResult => ({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      categories: [], // Recent package data doesn't include categories
      keywords: [], // Recent package data doesn't include keywords
      docsIpfsUrl: pkg.docsIpfsUrl,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt
    });
    
    return {
      recentlyCreated: data.recentlyCreated.map(mapPackage),
      recentlyUpdated: data.recentlyUpdated.map(mapPackage)
    };
  } catch (error) {
    console.error('Failed to fetch recent packages:', error);
    return {
      recentlyCreated: [],
      recentlyUpdated: []
    };
  }
}