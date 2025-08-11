import { NextRequest, NextResponse } from "next/server";
import { extract } from 'tar-stream';
import * as pako from 'pako';

// Server-side HTML cache with TTL
const htmlCache = new Map<string, { html: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Extract all files from IPFS tarball in one operation
async function extractAllFromIPFS(ipfsHash: string): Promise<Record<string, string>> {
  const urlVariants = [
    `https://dweb.link/ipfs/${ipfsHash}`, // Fastest IPFS gateway (588ms vs 4400ms)
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}?filename=docs.tgz`,
    `https://ipfs.io/ipfs/${ipfsHash}`,
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
  ];
  
  let response: Response | null = null;
  for (const url of urlVariants) {
    try {
      console.log(`Trying to fetch tarball from: ${url}`);
      response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        console.log(`Successfully fetched tarball from: ${url}`);
        break;
      }
    } catch (error) {
      console.log(`Failed to fetch from ${url}:`, error);
    }
  }
  
  if (!response || !response.ok) {
    throw new Error('Could not fetch tarball from any IPFS gateway');
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const compressed = new Uint8Array(arrayBuffer);
  
  // Decompress
  let decompressed: Uint8Array;
  try {
    decompressed = pako.ungzip(compressed);
  } catch (error) {
    throw new Error('Failed to decompress tarball');
  }
  
  // Extract all files
  return new Promise((resolve, reject) => {
    const files: Record<string, string> = {};
    const extractor = extract();
    
    extractor.on('entry', (header, stream, next) => {
      if (header.type === 'file') {
        let content = '';
        
        stream.on('data', (chunk) => {
          content += chunk.toString('utf8');
        });
        
        stream.on('end', () => {
          files[header.name] = content;
          next();
        });
        
        stream.on('error', (err) => {
          console.error(`Error reading ${header.name}:`, err);
          next();
        });
      } else {
        stream.on('end', next);
        stream.resume();
      }
    });
    
    extractor.on('finish', () => {
      console.log(`Extracted ${Object.keys(files).length} files from tarball`);
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
      `<html><body><h1>Pure Documentation</h1><p>Add an IPFS hash as a query parameter:</p><code>http://localhost:3000/docs/pure?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va</code></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // Check cache first - this should be under 1ms
  const cacheKey = `${ipfsHash}-${filePath}`;
  const cached = htmlCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache HIT for ${cacheKey} - serving instantly`);
    return new NextResponse(cached.html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'HIT',
      },
    });
  }

  console.log(`Cache MISS for ${cacheKey} - processing from IPFS`);

  try {
    // Extract all files from tarball in ONE operation
    const allFiles = await extractAllFromIPFS(ipfsHash);
    
    // Get the HTML file
    const docContent = allFiles[filePath];
    if (!docContent) {
      throw new Error(`File ${filePath} not found in tarball`);
    }
    
    // Handle byte code conversion if needed
    let actualContent = docContent;
    const firstChar = docContent.substring(0, 10);
    
    if (firstChar.includes(',') && /^\d+,\d+/.test(firstChar)) {
      const byteCodes = docContent.split(',').map(num => parseInt(num.trim()));
      actualContent = String.fromCharCode(...byteCodes);
    }
    
    // Extract CSS links and inline them
    const cssLinks = actualContent.match(/<link[^>]*rel="stylesheet"[^>]*>/gi) || [];
    console.log(`Found ${cssLinks.length} CSS links to inline`);
    
    // Extract CSS filenames and get them from the already-extracted files
    const cssFilenames = cssLinks
      .map(link => link.match(/href="[^"]*\/([^"/?]+\.css)/)?.[1])
      .filter(Boolean);
    
    console.log(`Processing ${cssFilenames.length} CSS files from extracted tarball`);
    
    let allInlineCSS = '';
    for (const filename of cssFilenames) {
      const cssPath = `static.files/${filename}`;
      const cssContent = allFiles[cssPath];
      
      if (cssContent) {
        let actualCSS = cssContent;
        if (cssContent.includes(',') && /^\d+,\d+/.test(cssContent.substring(0, 10))) {
          const byteCodes = cssContent.split(',').map(num => parseInt(num.trim()));
          actualCSS = String.fromCharCode(...byteCodes);
        }
        
        // Replace CSS variables with actual values to ensure they work
        let processedCSS = actualCSS;
        if (filename === 'swaydoc.css') {
          processedCSS = processedCSS.replace(/var\(--main-background-color\)/g, '#262e37');
          processedCSS = processedCSS.replace(/var\(--main-color\)/g, '#c5c5c5');
          processedCSS = processedCSS.replace(/var\(--sidebar-background-color\)/g, '#161f25');
          processedCSS = processedCSS.replace(/var\(--sidebar-background-color-hover\)/g, 'rgba(70, 70, 70, 0.33)');
          processedCSS = processedCSS.replace(/var\(--code-block-background-color\)/g, '#191f26');
          processedCSS = processedCSS.replace(/var\(--headings-border-bottom-color\)/g, '#5c6773');
          processedCSS = processedCSS.replace(/var\(--settings-input-color\)/g, '#ffb454');
          processedCSS = processedCSS.replace(/var\(--scrollbar-track-background-color\)/g, 'transparent');
          processedCSS = processedCSS.replace(/var\(--scrollbar-thumb-background-color\)/g, '#5c6773');
          processedCSS = processedCSS.replace(/var\(--scrollbar-color\)/g, '#5c6773 #24292f');
        }
        
        allInlineCSS += `/* ${filename} */\n${processedCSS}\n\n`;
      } else {
        console.error(`CSS file ${filename} not found in tarball`);
      }
    }

    // Fix static file paths (images, favicon, etc) - do this BEFORE removing CSS links
    let processedContent = actualContent;
    processedContent = processedContent.replace(
      /src="(\.\.\/)+static\.files\/([^"]+)"/g,
      `src="/docs/static/$2?ipfs=${ipfsHash}"`
    );
    
    // Fix favicon and other non-CSS href links to static files
    processedContent = processedContent.replace(
      /href="(\.\.\/)+static\.files\/([^"]+\.(?:svg|png|ico|woff|woff2|ttf))"/g,
      `href="/docs/static/$2?ipfs=${ipfsHash}"`
    );

    // Replace all CSS link tags with one inline style block
    processedContent = processedContent.replace(
      /<link[^>]*rel="stylesheet"[^>]*>/gi, 
      ''
    );
    
    // Insert the combined CSS into the head
    processedContent = processedContent.replace(
      '</head>',
      `<style>${allInlineCSS}</style></head>`
    );

    // Basic sanitization - remove scripts but keep everything else
    processedContent = processedContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    processedContent = processedContent.replace(/<script[^>]*\/>/gi, '');
    processedContent = processedContent.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Cache the processed HTML for next time
    htmlCache.set(cacheKey, {
      html: processedContent,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries occasionally (1% chance)
    if (Math.random() < 0.01) {
      const now = Date.now();
      for (const [key, value] of htmlCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          htmlCache.delete(key);
        }
      }
    }

    console.log(`Cached ${cacheKey} for future requests`);

    // Return the pure HTML document
    return new NextResponse(processedContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'MISS',
        // More permissive CSP for pure documentation
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https://gateway.pinata.cloud https://ipfs.io https://*.amazonaws.com;",
      },
    });

  } catch (error) {
    console.error('Error loading pure docs:', error);
    return new NextResponse(
      `<html><body><h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p></body></html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 500,
      }
    );
  }
}