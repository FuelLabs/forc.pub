import axios from "axios";
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

export class PackageNotFoundError extends Error {
  constructor(name: string, version?: string) {
    const versionSuffix = version ? `@${version}` : '';
    super(`Package not found: ${name}${versionSuffix}`);
    this.name = 'PackageNotFoundError';
  }
}

export async function getPackageDetail(name: string, version: string): Promise<PackageWithDocs> {
  try {
    const response = await HTTP.get('/package', { params: { name, version } });
    const data = response.data;
    
    return {
      name: data.name,
      version: data.version,
      description: data.description,
      docsIpfsUrl: data.docsIpfsUrl
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new PackageNotFoundError(name, version);
    }

    console.error(`Failed to fetch package details for ${name}@${version}`, error);
    throw new Error(`Failed to fetch package details for ${name}@${version}`);
  }
}

export async function getLatestVersion(name: string): Promise<string> {
  try {
    const response = await HTTP.get('/package', { params: { name } });
    return response.data.version;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new PackageNotFoundError(name);
    }

    console.error(`Failed to fetch latest version for ${name}`, error);
    throw new Error(`Failed to fetch latest version for ${name}`);
  }
}

export async function searchPackages(query: string): Promise<PackageSearchResult[]> {
  try {
    const response = await HTTP.get('/search', { 
      params: {
        q: query,
        page: DEFAULT_PAGE,
        per_page: MAX_SEARCH_RESULTS
      }
    });
    
    return response.data.data.map((pkg: PackagePreview) => ({
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
    const response = await HTTP.get('/recent_packages');
    const data: APIRecentPackagesResponse = response.data;
    
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
