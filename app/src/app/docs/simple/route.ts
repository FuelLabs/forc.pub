import { NextRequest, NextResponse } from "next/server";
import { extract } from 'tar-stream';
import * as pako from 'pako';

// Cache extracted files
const fileCache = new Map<string, Map<string, string>>();

async function extractFromIPFS(ipfsHash: string): Promise<Map<string, string>> {
  // Check cache
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
          // Handle byte code conversion
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
  const filePath = searchParams.get('file') || 'std/index.html';

  if (!ipfsHash) {
    return new NextResponse('Missing IPFS hash', { status: 400 });
  }

  try {
    const files = await extractFromIPFS(ipfsHash);
    let html = files.get(filePath);
    
    if (!html) {
      return new NextResponse('File not found', { status: 404 });
    }

    // ONLY fix the absolute minimum - static file paths
    html = html.replace(/href="\.\.\/static\.files\//g, `href="/docs/simple/static/`);
    html = html.replace(/src="\.\.\/static\.files\//g, `src="/docs/simple/static/`);
    
    // Fix internal doc links to use our route
    html = html.replace(/href="([^"]+\.html)"/g, (match, href) => {
      if (href.startsWith('http') || href.startsWith('#')) return match;
      
      // Resolve relative path
      let fullPath = href;
      if (href.startsWith('../')) {
        const currentDir = filePath.substring(0, filePath.lastIndexOf('/'));
        const parts = currentDir.split('/');
        const hrefParts = href.split('/');
        for (const part of hrefParts) {
          if (part === '..') parts.pop();
          else if (part !== '.') parts.push(part);
        }
        fullPath = parts.join('/');
      } else if (!href.includes('/')) {
        const currentDir = filePath.substring(0, filePath.lastIndexOf('/'));
        fullPath = currentDir + '/' + href;
      }
      
      return `href="/docs/simple?ipfs=${ipfsHash}&file=${fullPath}"`;
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Allow everything for now
        'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Serve static files
export async function GET_STATIC(request: NextRequest) {
  const pathParts = request.nextUrl.pathname.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const ipfsHash = request.nextUrl.searchParams.get('ipfs');
  
  if (!ipfsHash) {
    return new NextResponse('Missing IPFS hash', { status: 400 });
  }

  try {
    const files = await extractFromIPFS(ipfsHash);
    const content = files.get(`static.files/${fileName}`);
    
    if (!content) {
      return new NextResponse('File not found', { status: 404 });
    }

    const contentType = fileName.endsWith('.css') ? 'text/css' :
                       fileName.endsWith('.js') ? 'application/javascript' :
                       fileName.endsWith('.svg') ? 'image/svg+xml' :
                       'application/octet-stream';

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    return new NextResponse('Internal server error', { status: 500 });
  }
}