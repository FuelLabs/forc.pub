import { extract } from 'tar-stream';
import * as pako from 'pako';

export async function extractDocFromIPFS(ipfsHash: string, filePath: string): Promise<string> {
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
  
  for (const url of urlVariants) {
    if (!url) continue; // Skip null URLs (e.g., when S3 is not configured)
    
    try {
      console.log(`Attempting to fetch docs from: ${url}`);
      const response = await fetch(url);
      
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
      console.warn(`Error fetching from ${url}:`, error);
      // Continue to next URL variant
    }
  }
  
  throw new Error('Documentation not available from any source (IPFS or S3)');
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