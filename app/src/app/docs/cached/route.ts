import { NextRequest, NextResponse } from "next/server";
import { extract } from 'tar-stream';
import * as pako from 'pako';

// In-memory cache - persists for the lifetime of the server process
interface DocsCache {
  files: Map<string, string>;
  timestamp: number;
  ipfsHash: string;
}

let docsCache: DocsCache | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function loadDocsFromIPFS(ipfsHash: string): Promise<Map<string, string>> {
  console.log(`Loading docs from IPFS: ${ipfsHash}`);
  
  const urls = [
    `https://dweb.link/ipfs/${ipfsHash}`,
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tgz`,
    `https://ipfs.io/ipfs/${ipfsHash}`
  ];
  
  let response: Response | null = null;
  let lastError: Error | null = null;
  
  for (const url of urls) {
    try {
      console.log(`Trying ${url}`);
      response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (response.ok) {
        console.log(`Success with ${url}`);
        break;
      }
    } catch (error) {
      console.log(`Failed with ${url}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  
  if (!response || !response.ok) {
    throw lastError || new Error('Failed to fetch from any IPFS gateway');
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const compressed = new Uint8Array(arrayBuffer);
  const decompressed = pako.ungzip(compressed);
  
  return new Promise((resolve, reject) => {
    const files = new Map<string, string>();
    const extractor = extract();
    
    extractor.on('entry', (header, stream, next) => {
      if (header.type === 'file') {
        let content = '';
        stream.on('data', chunk => content += chunk.toString('utf8'));
        stream.on('end', () => {
          // Handle byte code conversion if needed
          if (content.includes(',') && /^\d+,\d+/.test(content.substring(0, 10))) {
            const byteCodes = content.split(',').map(num => parseInt(num.trim()));
            content = String.fromCharCode(...byteCodes);
          }
          files.set(header.name, content);
          next();
        });
        stream.on('error', next);
      } else {
        stream.on('end', next);
        stream.resume();
      }
    });
    
    extractor.on('finish', () => {
      console.log(`Loaded ${files.size} files from IPFS`);
      resolve(files);
    });
    
    extractor.on('error', reject);
    extractor.end(decompressed);
  });
}

async function getOrLoadDocs(ipfsHash: string): Promise<Map<string, string>> {
  const now = Date.now();
  
  // Check if cache is valid
  if (docsCache && 
      docsCache.ipfsHash === ipfsHash && 
      (now - docsCache.timestamp) < CACHE_DURATION) {
    console.log('Using cached docs');
    return docsCache.files;
  }
  
  // Cache is invalid or different hash, reload
  console.log('Cache miss or expired, loading fresh docs');
  const files = await loadDocsFromIPFS(ipfsHash);
  
  // Update cache
  docsCache = {
    files,
    timestamp: now,
    ipfsHash
  };
  
  return files;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ipfsHash = searchParams.get('ipfs') || 'QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va';
  const filePath = searchParams.get('path') || 'std/index.html';
  
  try {
    const files = await getOrLoadDocs(ipfsHash);
    const content = files.get(filePath);
    
    if (!content) {
      console.error(`File not found: ${filePath}`);
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Determine content type
    const ext = filePath.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case 'html':
        contentType = 'text/html; charset=utf-8';
        break;
      case 'css':
        contentType = 'text/css';
        break;
      case 'js':
        contentType = 'application/javascript';
        break;
      case 'svg':
        contentType = 'image/svg+xml';
        break;
      case 'woff2':
        contentType = 'font/woff2';
        break;
    }
    
    // For HTML files, rewrite paths to use our route
    if (ext === 'html') {
      let html = content;
      
      // Rewrite static file paths
      html = html.replace(
        /href="\.\.\/static\.files\/([^"]+)"/g,
        `/docs/cached?ipfs=${ipfsHash}&path=static.files/$1`
      );
      html = html.replace(
        /src="\.\.\/static\.files\/([^"]+)"/g,
        `/docs/cached?ipfs=${ipfsHash}&path=static.files/$1`
      );
      
      // Rewrite search.js path
      html = html.replace(
        /src="\.\.\/search\.js"/g,
        `/docs/cached?ipfs=${ipfsHash}&path=search.js`
      );
      
      // Rewrite HTML navigation links
      html = html.replace(
        /href="([^"]+\.html)"/g,
        (match, href) => {
          if (href.startsWith('http') || href.startsWith('#')) return match;
          
          let targetPath = href;
          
          // Handle relative paths
          if (href.startsWith('../')) {
            // Remove ../ 
            targetPath = href.substring(3);
          } else {
            // Same directory links - add current directory
            const currentDir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (currentDir && !href.includes('/')) {
              targetPath = currentDir + '/' + href;
            }
          }
          
          // Ensure std/ prefix for documentation files
          if (!targetPath.startsWith('std/') && filePath.startsWith('std/')) {
            targetPath = 'std/' + targetPath;
          }
          
          return `href="/docs/cached?ipfs=${ipfsHash}&path=${targetPath}"`;
        }
      );
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': docsCache ? 'HIT' : 'MISS',
        },
      });
    }
    
    // For non-HTML files, serve as-is
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24 hours for static assets
        'X-Cache': docsCache ? 'HIT' : 'MISS',
      },
    });
    
  } catch (error) {
    console.error('Error serving cached docs:', error);
    return new NextResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
      status: 500 
    });
  }
}

// Add a manual cache flush endpoint
export async function DELETE() {
  docsCache = null;
  console.log('Docs cache flushed');
  return new NextResponse('Cache flushed', { status: 200 });
}