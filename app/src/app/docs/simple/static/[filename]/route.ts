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

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const ipfsHash = request.nextUrl.searchParams.get('ipfs');
  
  if (!ipfsHash) {
    return new NextResponse('Missing IPFS hash', { status: 400 });
  }

  try {
    const files = await extractFromIPFS(ipfsHash);
    const content = files.get(`static.files/${params.filename}`);
    
    if (!content) {
      return new NextResponse('File not found', { status: 404 });
    }

    const contentType = params.filename.endsWith('.css') ? 'text/css' :
                       params.filename.endsWith('.js') ? 'application/javascript' :
                       params.filename.endsWith('.svg') ? 'image/svg+xml' :
                       params.filename.endsWith('.woff2') ? 'font/woff2' :
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