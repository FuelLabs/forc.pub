import HTTP, { PackagePreview } from "../../../utils/http";
import { RecentPackage, RecentPackagesResponse as APIRecentPackagesResponse } from "../../dashboard/hooks/useFetchRecentPackages";

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
  hasDocumentation: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecentPackagesResponse {
  recentlyCreated: PackageSearchResult[];
  recentlyUpdated: PackageSearchResult[];
}

export async function getPackageDetail(name: string, version: string): Promise<PackageWithDocs> {
  try {
    const response = await HTTP.get('/package', {
      params: { name, version }
    });
    
    return {
      name: response.data.name,
      version: response.data.version,
      description: response.data.description,
      docsIpfsUrl: response.data.docsIpfsUrl
    };
  } catch {
    throw new Error(`Failed to fetch package details for ${name}@${version}`);
  }
}

export async function getLatestVersion(name: string): Promise<string> {
  try {
    const response = await HTTP.get('/package', {
      params: { name }
    });
    
    return response.data.version;
  } catch {
    throw new Error(`Failed to fetch latest version for ${name}`);
  }
}

export async function searchPackages(query: string): Promise<PackageSearchResult[]> {
  try {
    const response = await HTTP.get('/search', {
      params: { 
        q: query,
        page: "1",
        per_page: "20"
      }
    });
    
    return response.data.data.map((pkg: PackagePreview) => ({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      categories: pkg.categories,
      keywords: pkg.keywords,
      hasDocumentation: true // For now, assume packages have docs if they're in search results
    }));
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

export async function getRecentPackages(): Promise<RecentPackagesResponse> {
  try {
    // Temporarily use local Next.js API route while backend is compiling
    const response = await fetch('/api/recent_packages_temp');
    const data: APIRecentPackagesResponse = await response.json();
    
    const mapPackage = (pkg: RecentPackage): PackageSearchResult => ({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      categories: [], // Recent package data doesn't include categories
      keywords: [], // Recent package data doesn't include keywords
      hasDocumentation: true, // For now, assume packages have docs if they're in recent results
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