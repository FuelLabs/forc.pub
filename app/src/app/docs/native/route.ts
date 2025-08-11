import { NextRequest, NextResponse } from "next/server";
import { extract } from 'tar-stream';
import * as pako from 'pako';

const fileCache = new Map<string, Map<string, string>>();

async function extractFromIPFS(ipfsHash: string): Promise<Map<string, string>> {
  if (fileCache.has(ipfsHash)) {
    return fileCache.get(ipfsHash)!;
  }

  const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tgz`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch from IPFS');
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
      fileCache.set(ipfsHash, files);
      resolve(files);
    });
    
    extractor.on('error', reject);
    extractor.end(decompressed);
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ipfsHash = searchParams.get('ipfs');
  const requestedPath = searchParams.get('path') || 'std/index.html';

  if (!ipfsHash) {
    return new NextResponse(
      `<html><body><h1>Native Documentation</h1><p>Add IPFS hash: ?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va&path=std/index.html</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    console.log(`Native docs - Loading ${requestedPath} from ${ipfsHash}`);
    const files = await extractFromIPFS(ipfsHash);
    
    // Handle different file types
    if (requestedPath === 'search.js') {
      const jsContent = files.get('search.js');
      if (jsContent) {
        return new NextResponse(jsContent, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
    
    // Handle static files
    if (requestedPath.startsWith('static.files/')) {
      const staticFile = files.get(requestedPath);
      if (staticFile) {
        const ext = requestedPath.split('.').pop();
        const contentType = 
          ext === 'css' ? 'text/css' :
          ext === 'js' ? 'application/javascript' :
          ext === 'svg' ? 'image/svg+xml' :
          ext === 'woff2' ? 'font/woff2' :
          'application/octet-stream';
        
        return new NextResponse(staticFile, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      }
    }
    
    // Handle HTML files
    const htmlContent = files.get(requestedPath);
    if (!htmlContent) {
      console.error(`File not found: ${requestedPath}`);
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Transform the HTML to work with our routing - PRESERVE ORIGINAL PATHS AS MUCH AS POSSIBLE
    let processedHtml = htmlContent;
    
    // Only rewrite paths that need our routing
    // Static files
    processedHtml = processedHtml.replace(
      /href="\.\.\/static\.files\/([^"]+)"/g, 
      `href="/docs/native?ipfs=${ipfsHash}&path=static.files/$1"`
    );
    processedHtml = processedHtml.replace(
      /src="\.\.\/static\.files\/([^"]+)"/g, 
      `src="/docs/native?ipfs=${ipfsHash}&path=static.files/$1"`
    );
    
    // Search script
    processedHtml = processedHtml.replace(
      /src="\.\.\/search\.js"/g, 
      `src="/docs/native?ipfs=${ipfsHash}&path=search.js"`
    );
    
    // HTML navigation links
    processedHtml = processedHtml.replace(
      /href="([^"]+\.html)"/g, 
      (match, href) => {
        if (href.startsWith('http') || href.startsWith('#')) return match;
        
        let targetPath = href;
        
        // Resolve relative paths properly
        if (href.startsWith('../')) {
          // Going up from current directory
          const currentDir = requestedPath.substring(0, requestedPath.lastIndexOf('/'));
          targetPath = href.replace('../', '');
        } else {
          // Relative path in same directory
          const currentDir = requestedPath.substring(0, requestedPath.lastIndexOf('/'));
          if (currentDir && !href.includes('/')) {
            targetPath = currentDir + '/' + href;
          }
        }
        
        // Make sure std/ prefix is correct
        if (!targetPath.startsWith('std/') && requestedPath.startsWith('std/')) {
          targetPath = 'std/' + targetPath;
        }
        
        return `href="/docs/native?ipfs=${ipfsHash}&path=${targetPath}"`;
      }
    );

    return new NextResponse(processedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}