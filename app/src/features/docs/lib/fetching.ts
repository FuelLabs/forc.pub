import { extract } from 'tar-stream';
import * as pako from 'pako';
import { validateIPFSHash } from './security';
import { getCachedFile, setCachedFile } from './cache';
import { convertByteCodeContent } from './utils';
async function fetchFromIPFS(ipfsHash: string): Promise<ArrayBuffer> {
  const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(ipfsUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.arrayBuffer();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('IPFS fetch timeout after 30 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromS3(ipfsHash: string): Promise<ArrayBuffer> {
  const bucketName = process.env.S3_BUCKET_NAME;
  const bucketRegion = process.env.S3_BUCKET_REGION;
  
  if (!bucketName || !bucketRegion) {
    throw new Error('S3 configuration missing');
  }
  
  const s3Url = `https://${bucketName}.s3.${bucketRegion}.amazonaws.com/${ipfsHash}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(s3Url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`S3 HTTP error! status: ${response.status}`);
    }
    
    return response.arrayBuffer();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('S3 fetch timeout after 30 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithFallback(ipfsHash: string): Promise<ArrayBuffer> {
  try {
    console.log(`Attempting to fetch from IPFS: ${ipfsHash}`);
    return await fetchFromIPFS(ipfsHash);
  } catch (ipfsError) {
    console.warn(`IPFS fetch failed for ${ipfsHash}:`, ipfsError);
    console.log(`Falling back to S3 for: ${ipfsHash}`);
    
    try {
      const result = await fetchFromS3(ipfsHash);
      console.log(`Successfully fetched from S3: ${ipfsHash}`);
      return result;
    } catch (s3Error) {
      console.error(`S3 fallback also failed for ${ipfsHash}:`, s3Error);
      throw new Error(`Both IPFS and S3 failed. IPFS: ${ipfsError}. S3: ${s3Error}`);
    }
  }
}

export async function extractDocFromIPFS(ipfsHash: string, filePath: string): Promise<string> {
  const validatedHash = validateIPFSHash(ipfsHash);
  
  // Check cache first
  const cached = getCachedFile(validatedHash, filePath);
  if (cached) {
    return cached;
  }

  // Fetch and extract with fallback
  const contentBuffer = await fetchWithFallback(validatedHash);
  const content = await extractFileFromTarball(contentBuffer, filePath);
  
  if (!content) {
    throw new Error(`File not found: ${filePath}`);
  }

  const actualContent = convertByteCodeContent(content);
  
  setCachedFile(validatedHash, filePath, actualContent);
  
  return actualContent;
}

export async function extractAllFromTarball(ipfsHash: string): Promise<Map<string, string>> {
  const validatedHash = validateIPFSHash(ipfsHash);
  const contentBuffer = await fetchWithFallback(validatedHash);
  const files = await extractAllFilesFromTarball(contentBuffer);
  
  if (files.size === 0) {
    throw new Error('No files found in documentation tarball');
  }

  const processedFiles = new Map<string, string>();
  for (const [filePath, content] of files.entries()) {
    const actualContent = convertByteCodeContent(content);
    processedFiles.set(filePath, actualContent);
  }
  
  return processedFiles;
}

async function extractFileFromTarball(contentBuffer: ArrayBuffer, targetFilePath: string): Promise<string | null> {
  const compressed = new Uint8Array(contentBuffer);
  let decompressed: Uint8Array;
  
  try {
    decompressed = pako.ungzip(compressed);
  } catch (error) {
    throw new Error(`Failed to decompress tarball: ${error instanceof Error ? error.message : 'Unknown decompression error'}`);
  }
  
  return new Promise((resolve, reject) => {
    const extractor = extract();
    
    extractor.on('entry', (header, stream, next) => {
      if (header.type === 'file' && (
        header.name === targetFilePath ||
        header.name.endsWith(`/${targetFilePath}`) ||
        (targetFilePath === 'index.html' && header.name.endsWith('/index.html'))
      )) {
        let content = '';
        stream.on('data', (chunk) => content += chunk.toString('utf8'));
        stream.on('end', () => resolve(content));
        stream.on('error', reject);
      } else {
        stream.on('end', next);
        stream.resume();
      }
    });
    
    extractor.on('finish', () => resolve(null));
    extractor.on('error', reject);
    extractor.end(decompressed);
  });
}

async function extractAllFilesFromTarball(contentBuffer: ArrayBuffer): Promise<Map<string, string>> {
  const compressed = new Uint8Array(contentBuffer);
  let decompressed: Uint8Array;
  
  try {
    decompressed = pako.ungzip(compressed);
  } catch (error) {
    throw new Error(`Failed to decompress tarball: ${error instanceof Error ? error.message : 'Unknown decompression error'}`);
  }
  
  return new Promise((resolve, reject) => {
    const extractor = extract();
    const files = new Map<string, string>();
    
    extractor.on('entry', (header, stream, next) => {
      if (header.type === 'file') {
        let content = '';
        stream.on('data', (chunk) => content += chunk.toString('utf8'));
        stream.on('end', () => {
          files.set(header.name, content);
          next();
        });
        stream.on('error', reject);
      } else {
        stream.on('end', next);
        stream.resume();
      }
    });
    
    extractor.on('finish', () => resolve(files));
    extractor.on('error', reject);
    extractor.end(decompressed);
  });
}