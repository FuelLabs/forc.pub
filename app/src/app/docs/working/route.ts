import { NextRequest, NextResponse } from "next/server";
import { extract } from 'tar-stream';
import * as pako from 'pako';

const fileCache = new Map<string, Map<string, Buffer>>();

async function extractFromIPFS(ipfsHash: string): Promise<Map<string, Buffer>> {
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
    const files = new Map<string, Buffer>();
    const extractor = extract();
    
    extractor.on('entry', (header, stream, next) => {
      if (header.type === 'file') {
        const chunks: Buffer[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          files.set(header.name, Buffer.concat(chunks));
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
  const filePath = searchParams.get('file') || 'std/index.html';

  if (!ipfsHash) {
    return new NextResponse(
      `<html><body><h1>Documentation</h1><p>Add IPFS hash: ?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    const files = await extractFromIPFS(ipfsHash);
    
    // Handle JavaScript files
    if (filePath === 'search.js') {
      const jsBuffer = files.get('search.js');
      if (jsBuffer) {
        return new NextResponse(jsBuffer, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
    
    // Handle static files
    if (filePath.startsWith('static.files/')) {
      const staticFile = files.get(filePath);
      if (staticFile) {
        const ext = filePath.split('.').pop();
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
    const htmlBuffer = files.get(filePath);
    if (!htmlBuffer) {
      return new NextResponse('File not found', { status: 404 });
    }
    
    let html = htmlBuffer.toString('utf8');
    
    // Handle byte code conversion if needed
    if (html.includes(',') && /^\d+,\d+/.test(html.substring(0, 10))) {
      const byteCodes = html.split(',').map(num => parseInt(num.trim()));
      html = String.fromCharCode(...byteCodes);
    }
    
    // Fix paths to work with our routing
    // Static files
    html = html.replace(/href="\.\.\/static\.files\//g, `href="/docs/working?ipfs=${ipfsHash}&file=static.files/`);
    html = html.replace(/src="\.\.\/static\.files\//g, `src="/docs/working?ipfs=${ipfsHash}&file=static.files/`);
    
    // Search.js
    html = html.replace(/src="\.\.\/search\.js"/g, `src="/docs/working?ipfs=${ipfsHash}&file=search.js"`);
    html = html.replace(/src="search\.js"/g, `src="/docs/working?ipfs=${ipfsHash}&file=search.js"`);
    
    // Documentation links
    html = html.replace(/href="([^"]+\.html)"/g, (match, href) => {
      if (href.startsWith('http') || href.startsWith('#')) return match;
      
      let fullPath = href;
      if (href.startsWith('../')) {
        const currentDir = filePath.substring(0, filePath.lastIndexOf('/'));
        const parts = currentDir.split('/').filter(p => p);
        const hrefParts = href.split('/');
        for (const part of hrefParts) {
          if (part === '..') {
            parts.pop();
          } else if (part && part !== '.') {
            parts.push(part);
          }
        }
        fullPath = parts.join('/');
      } else if (!href.includes('/')) {
        const currentDir = filePath.substring(0, filePath.lastIndexOf('/'));
        fullPath = currentDir ? currentDir + '/' + href : href;
      }
      
      if (!fullPath.startsWith('std/')) {
        fullPath = 'std/' + fullPath;
      }
      
      return `href="/docs/working?ipfs=${ipfsHash}&file=${fullPath}"`;
    });

    return new NextResponse(html, {
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