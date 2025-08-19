import { LRUCache } from 'lru-cache';

/// LRU cache implementation for documentation content
/// Prevents memory exhaustion while maintaining performance for frequently accessed docs

interface DocsCache {
  files: Map<string, string>;
  timestamp: number;
  ipfsHash: string;
}

// Cache configuration constants
const MAX_PACKAGE_CACHE_SIZE = 100;
const MAX_FILE_CACHE_SIZE = 1000;
const PACKAGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FILE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// LRU cache for package documentation
const packageCaches = new LRUCache<string, DocsCache>({
  max: MAX_PACKAGE_CACHE_SIZE,
  ttl: PACKAGE_CACHE_TTL,
  updateAgeOnGet: true,
  allowStale: false,
  // Dispose function called when entries are evicted
  dispose: (value: DocsCache, key: string) => {
    console.log(`Evicting docs cache for ${key} (${value.files.size} files)`);
  }
});

// Individual file cache for single file requests
const fileCaches = new LRUCache<string, string>({
  max: MAX_FILE_CACHE_SIZE,
  ttl: FILE_CACHE_TTL,
  updateAgeOnGet: true,
  allowStale: false
});

export interface CacheStats {
  packageCacheSize: number;
  packageCacheHits: number;
  packageCacheMisses: number;
  fileCacheSize: number;
  fileCacheHits: number;
  fileCacheMisses: number;
}

let packageCacheHits = 0;
let packageCacheMisses = 0;
let fileCacheHits = 0;
let fileCacheMisses = 0;

export function getCachedPackageDocs(packageName: string, version: string): DocsCache | undefined {
  const cacheKey = `${packageName}@${version}`;
  const cached = packageCaches.get(cacheKey);
  
  if (cached) {
    packageCacheHits++;
    console.log(`Package cache HIT for ${cacheKey}`);
    return cached;
  }
  
  packageCacheMisses++;
  console.log(`Package cache MISS for ${cacheKey}`);
  return undefined;
}

export function setCachedPackageDocs(
  packageName: string, 
  version: string, 
  docsCache: DocsCache
): void {
  const cacheKey = `${packageName}@${version}`;
  packageCaches.set(cacheKey, docsCache);
  console.log(`Cached docs for ${cacheKey} (${docsCache.files.size} files)`);
}

/// Gets cached individual file content
export function getCachedFile(ipfsHash: string, filePath: string): string | undefined {
  const cacheKey = `${ipfsHash}-${filePath}`;
  const cached = fileCaches.get(cacheKey);
  
  if (cached) {
    fileCacheHits++;
    console.log(`File cache HIT for ${cacheKey}`);
    return cached;
  }
  
  fileCacheMisses++;
  console.log(`File cache MISS for ${cacheKey}`);
  return undefined;
}

export function setCachedFile(ipfsHash: string, filePath: string, content: string): void {
  const cacheKey = `${ipfsHash}-${filePath}`;
  fileCaches.set(cacheKey, content);
  console.log(`Cached file ${cacheKey} (${content.length} bytes)`);
}

export function evictPackageFromCache(packageName: string, version: string): boolean {
  const cacheKey = `${packageName}@${version}`;
  const deleted = packageCaches.delete(cacheKey);
  
  if (deleted) {
    console.log(`Evicted package cache for ${cacheKey}`);
  }
  
  return deleted;
}

export function evictAllPackageVersionsFromCache(packageName: string): number {
  let evictedCount = 0;
  
  for (const key of packageCaches.keys()) {
    if (key.startsWith(`${packageName}@`)) {
      packageCaches.delete(key);
      evictedCount++;
    }
  }
  
  console.log(`Evicted ${evictedCount} versions of ${packageName} from cache`);
  return evictedCount;
}

/// Clears all caches
export function clearAllCaches(): void {
  const packageCount = packageCaches.size;
  const fileCount = fileCaches.size;
  
  packageCaches.clear();
  fileCaches.clear();
  
  // Reset stats
  packageCacheHits = 0;
  packageCacheMisses = 0;
  fileCacheHits = 0;
  fileCacheMisses = 0;
  
  console.log(`Cleared all caches: ${packageCount} packages, ${fileCount} files`);
}

/// Gets cache statistics
export function getCacheStats(): CacheStats {
  return {
    packageCacheSize: packageCaches.size,
    packageCacheHits,
    packageCacheMisses,
    fileCacheSize: fileCaches.size,
    fileCacheHits,
    fileCacheMisses
  };
}

/// Pre-warms cache with popular packages (can be called on startup)
export async function prewarmCache(popularPackages: Array<{ name: string; version: string }>): Promise<void> {
  console.log(`Pre-warming cache with ${popularPackages.length} popular packages`);
  
  for (const pkg of popularPackages) {
    console.log(`Would pre-warm ${pkg.name}@${pkg.version}`);
  }
}