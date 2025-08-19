/// Simple IPFS utilities following existing forc.pub patterns
/// Based on useAbiContent.ts approach

import { extract } from 'tar-stream';
import * as pako from 'pako';
import { validateIPFSHash } from './security';
import { getCachedFile, setCachedFile } from './cache';
import { convertByteCodeContent, isHtmlFile } from './utils';

/// Simple IPFS fetch - follows useAbiContent.ts pattern
async function fetchFromIPFS(ipfsHash: string): Promise<ArrayBuffer> {
  const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  
  const response = await fetch(ipfsUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.arrayBuffer();
}

/// Extract single file from tarball
export async function extractDocFromIPFS(ipfsHash: string, filePath: string): Promise<string> {
  const validatedHash = validateIPFSHash(ipfsHash);
  
  // Check cache first
  const cached = getCachedFile(validatedHash, filePath);
  if (cached) {
    return cached;
  }

  // Fetch and extract
  const contentBuffer = await fetchFromIPFS(validatedHash);
  const content = await extractFileFromTarball(contentBuffer, filePath);
  
  if (!content) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Process content
  const actualContent = convertByteCodeContent(content);
  const finalContent = isHtmlFile(filePath) ? actualContent : actualContent; // Could add sanitization here if needed
  
  // Cache result
  setCachedFile(validatedHash, filePath, finalContent);
  
  return finalContent;
}

/// Extract all files from tarball  
export async function extractAllFromTarball(ipfsHash: string): Promise<Map<string, string>> {
  const validatedHash = validateIPFSHash(ipfsHash);
  const contentBuffer = await fetchFromIPFS(validatedHash);
  const files = await extractAllFilesFromTarball(contentBuffer);
  
  if (files.size === 0) {
    throw new Error('No files found in documentation tarball');
  }

  // Process all files
  const processedFiles = new Map<string, string>();
  for (const [filePath, content] of files.entries()) {
    const actualContent = convertByteCodeContent(content);
    processedFiles.set(filePath, actualContent);
  }
  
  return processedFiles;
}

/// Basic tarball extraction
async function extractFileFromTarball(contentBuffer: ArrayBuffer, targetFilePath: string): Promise<string | null> {
  const compressed = new Uint8Array(contentBuffer);
  const decompressed = pako.ungzip(compressed);
  
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

/// Extract all files from tarball
async function extractAllFilesFromTarball(contentBuffer: ArrayBuffer): Promise<Map<string, string>> {
  const compressed = new Uint8Array(contentBuffer);
  const decompressed = pako.ungzip(compressed);
  
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