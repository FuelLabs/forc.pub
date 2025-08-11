import { extract } from 'tar-stream';
import * as pako from 'pako';

// Simple in-memory cache with TTL for documentation content
const documentationCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function extractDocFromIPFS(ipfsHash: string, filePath: string): Promise<string> {
  // Check cache first
  const cacheKey = `${ipfsHash}-${filePath}`;
  const cached = documentationCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache hit for ${cacheKey}`);
    return cached.content;
  }
  const urlVariants: (string | null)[] = [
    // Primary: Try Pinata with docs.tgz filename (matches backend)
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tgz`,
    // Fallback: Try Pinata with docs.tar.gz filename
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tar.gz`,
    // Fallback: Try alternative IPFS gateway
    `https://ipfs.io/ipfs/${ipfsHash}`,
    // S3 fallback: Try S3 backup if configured
    ipfsHashToS3Url(ipfsHash),
    // Final fallback: Try without filename parameter
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
  ];
  
  // Try fast endpoints first with shorter timeout, then longer ones
  const fastUrls = urlVariants.slice(0, 2).filter(Boolean) as string[];
  const slowUrls = urlVariants.slice(2).filter(Boolean) as string[];

  const tryUrlsWithTimeout = async (urls: string[], timeoutMs: number) => {
    for (const url of urls) {
      try {
        console.log(`Attempting to fetch docs from: ${url} (timeout: ${timeoutMs}ms)`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const content = await extractFromTarball(response, filePath);
          if (content) {
            console.log(`Successfully extracted ${filePath} from ${url}`);
            return content;
          }
        } else {
          console.warn(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(`Timeout fetching from ${url} after ${timeoutMs}ms`);
        } else {
          console.warn(`Error fetching from ${url}:`, error);
        }
      }
    }
    return null;
  };

  // Try fast URLs first (3s timeout), then slow ones (10s timeout)
  let content = await tryUrlsWithTimeout(fastUrls, 3000);
  if (!content && slowUrls.length > 0) {
    content = await tryUrlsWithTimeout(slowUrls, 10000);
  }

  if (!content) {
    throw new Error('Documentation not available from any source (IPFS or S3)');
  }

  // Cache the successful result
  documentationCache.set(cacheKey, {
    content,
    timestamp: Date.now()
  });
  
  // Simple cache cleanup - remove expired entries occasionally (10% chance)
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [key, value] of documentationCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        documentationCache.delete(key);
      }
    }
  }

  return content;
}

async function extractFromTarball(response: Response, targetFilePath: string): Promise<string | null> {
  try {
    const arrayBuffer = await response.arrayBuffer();
    const compressed = new Uint8Array(arrayBuffer);
    
    // Decompress gzipped data
    let decompressed: Uint8Array;
    try {
      decompressed = pako.ungzip(compressed);
    } catch (error) {
      console.error('Failed to decompress tarball:', error);
      return null;
    }
    
    return new Promise((resolve, reject) => {
      const extractor = extract();
      let found = false;
      extractor.on('entry', (header, stream, next) => {
        // Look for the exact file path or index.html if path matches directory
        const shouldExtract = 
          header.name === targetFilePath ||
          header.name.endsWith(`/${targetFilePath}`) ||
          (targetFilePath.endsWith('/') && header.name === `${targetFilePath}index.html`) ||
          (targetFilePath === 'index.html' && (header.name === 'index.html' || header.name.endsWith('/index.html')));
        
        if (shouldExtract && header.type === 'file') {
          found = true;
          let content = '';
          
          stream.on('data', (chunk) => {
            content += chunk.toString('utf8');
          });
          
          stream.on('end', () => {
            resolve(content);
            next();
          });
          
          stream.on('error', (err) => {
            console.error('Stream error:', err);
            next();
          });
        } else {
          stream.on('end', next);
          stream.resume(); // Skip this file
        }
      });
      
      extractor.on('finish', () => {
        if (!found) {
          reject(new Error(`File not found: ${targetFilePath}`));
        }
      });
      
      extractor.on('error', (err) => {
        console.error('Extraction error:', err);
        reject(err);
      });
      
      // Write decompressed data to extractor
      extractor.end(decompressed);
    });
  } catch (error) {
    console.error('Tarball processing error:', error);
    return null;
  }
}

export function ipfsHashToS3Url(ipfsHash: string): string | null {
  // This constructs an S3 URL for the documentation tarball
  // The S3 bucket stores files with the IPFS hash as the key
  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
  const bucketRegion = process.env.NEXT_PUBLIC_S3_BUCKET_REGION;
  
  if (!bucketName || !bucketRegion) {
    console.warn('S3 bucket configuration not available for fallback');
    return null;
  }
  
  return `https://${bucketName}.s3.${bucketRegion}.amazonaws.com/${ipfsHash}`;
}

// Debug function to list all files in a tarball
export async function debugTarballStructure(ipfsHash: string): Promise<string[]> {
  const urlVariants: (string | null)[] = [
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tgz`,
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tar.gz`,
    `https://ipfs.io/ipfs/${ipfsHash}`,
    ipfsHashToS3Url(ipfsHash),
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
  ];
  
  for (const url of urlVariants.filter(Boolean) as string[]) {
    try {
      console.log(`Attempting to fetch for debug from: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const compressed = new Uint8Array(arrayBuffer);
        
        let decompressed: Uint8Array;
        try {
          decompressed = pako.ungzip(compressed);
        } catch (error) {
          console.error('Failed to decompress tarball for debug:', error);
          continue;
        }
        
        return new Promise((resolve, reject) => {
          const extractor = extract();
          const allFiles: string[] = [];
          
          extractor.on('entry', (header, stream, next) => {
            allFiles.push(header.name);
            stream.on('end', next);
            stream.resume(); // Skip all files, just collect names
          });
          
          extractor.on('finish', () => {
            resolve(allFiles);
          });
          
          extractor.on('error', (err) => {
            console.error('Debug extraction error:', err);
            reject(err);
          });
          
          extractor.end(decompressed);
        });
      }
    } catch (error) {
      console.warn(`Debug fetch failed from ${url}:`, error);
    }
  }
  
  return [];
}

// Extract all files from IPFS tarball
export async function extractAllFromTarball(ipfsHash: string): Promise<Map<string, string>> {
  const urlVariants: (string | null)[] = [
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tgz`,
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tar.gz`,
    `https://ipfs.io/ipfs/${ipfsHash}`,
    ipfsHashToS3Url(ipfsHash),
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
  ];
  
  const tryUrlsWithTimeout = async (urls: string[], timeoutMs: number) => {
    for (const url of urls) {
      try {
        console.log(`Attempting to fetch all files from: ${url} (timeout: ${timeoutMs}ms)`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const files = await extractAllFilesFromTarball(response);
          if (files && files.size > 0) {
            console.log(`Successfully extracted ${files.size} files from ${url}`);
            return files;
          }
        } else {
          console.warn(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(`Timeout fetching from ${url} after ${timeoutMs}ms`);
        } else {
          console.warn(`Error fetching from ${url}:`, error);
        }
      }
    }
    return null;
  };

  // Try fast URLs first (3s timeout), then slow ones (10s timeout)
  const fastUrls = urlVariants.slice(0, 2).filter(Boolean) as string[];
  const slowUrls = urlVariants.slice(2).filter(Boolean) as string[];
  
  let files = await tryUrlsWithTimeout(fastUrls, 3000);
  if (!files && slowUrls.length > 0) {
    files = await tryUrlsWithTimeout(slowUrls, 10000);
  }

  if (!files) {
    throw new Error('Documentation not available from any source (IPFS or S3)');
  }

  return files;
}

async function extractAllFilesFromTarball(response: Response): Promise<Map<string, string> | null> {
  try {
    const arrayBuffer = await response.arrayBuffer();
    const compressed = new Uint8Array(arrayBuffer);
    
    // Decompress gzipped data
    let decompressed: Uint8Array;
    try {
      decompressed = pako.ungzip(compressed);
    } catch (error) {
      console.error('Failed to decompress tarball:', error);
      return null;
    }
    
    return new Promise((resolve, reject) => {
      const extractor = extract();
      const allFiles = new Map<string, string>();
      
      extractor.on('entry', (header, stream, next) => {
        if (header.type === 'file') {
          let content = '';
          
          stream.on('data', (chunk) => {
            content += chunk.toString('utf8');
          });
          
          stream.on('end', () => {
            allFiles.set(header.name, content);
            next();
          });
          
          stream.on('error', (err) => {
            console.error('Stream error:', err);
            next();
          });
        } else {
          stream.on('end', next);
          stream.resume(); // Skip this entry
        }
      });
      
      extractor.on('finish', () => {
        resolve(allFiles);
      });
      
      extractor.on('error', (err) => {
        console.error('Extraction error:', err);
        reject(err);
      });
      
      // Write decompressed data to extractor
      extractor.end(decompressed);
    });
  } catch (error) {
    console.error('Tarball processing error:', error);
    return null;
  }
}