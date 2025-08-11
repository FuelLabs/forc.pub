import { NextRequest, NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

// In-memory cache - persists for the lifetime of the server process
interface DocsCache {
  files: Map<string, string>;
  timestamp: number;
}

let docsCache: DocsCache | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const LOCAL_DOCS_PATH = '/Users/joshuabatty/Documents/rust/fuel/sway/sway-lib-std/out/doc';

function loadAllDocsFromDisk(): Map<string, string> {
  console.log('Loading all docs from disk into memory...');
  const files = new Map<string, string>();
  
  function walkDirectory(dir: string, baseDir: string = '') {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = baseDir ? path.join(baseDir, item) : item;
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDirectory(fullPath, relativePath);
      } else {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          files.set(relativePath, content);
        } catch (error) {
          console.warn(`Failed to read ${fullPath}:`, error);
        }
      }
    }
  }
  
  walkDirectory(LOCAL_DOCS_PATH);
  console.log(`Loaded ${files.size} files into memory cache`);
  return files;
}

function getOrLoadDocs(): Map<string, string> {
  const now = Date.now();
  
  // Check if cache is valid
  if (docsCache && (now - docsCache.timestamp) < CACHE_DURATION) {
    console.log('Using cached docs');
    return docsCache.files;
  }
  
  // Cache is invalid, reload
  console.log('Cache miss or expired, loading fresh docs from disk');
  const files = loadAllDocsFromDisk();
  
  // Update cache
  docsCache = {
    files,
    timestamp: now,
  };
  
  return files;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path') || 'std/index.html';
  
  try {
    const files = getOrLoadDocs();
    const content = files.get(filePath);
    
    if (!content) {
      console.error(`File not found: ${filePath}`);
      console.log('Available files:', Array.from(files.keys()).slice(0, 10));
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
      
      // Rewrite static file paths - convert ../static.files/ to our route
      html = html.replace(
        /href="\.\.\/static\.files\/([^"]+)"/g,
        (match, filename) => `href="/docs/simple-cached?path=static.files/${filename}"`
      );
      html = html.replace(
        /src="\.\.\/static\.files\/([^"]+)"/g,
        (match, filename) => `src="/docs/simple-cached?path=static.files/${filename}"`
      );
      
      // Rewrite search.js path
      html = html.replace(
        /src="\.\.\/search\.js"/g,
        'src="/docs/simple-cached?path=search.js"'
      );
      
      // Rewrite HTML navigation links
      html = html.replace(
        /href="([^"]+\.html)"/g,
        (match, href) => {
          if (href.startsWith('http') || href.startsWith('#')) return match;
          
          let targetPath = href;
          
          // Handle relative paths
          if (href.startsWith('../')) {
            // Going up from current directory (like ../option/index.html)
            targetPath = href.substring(3); // Remove ../
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
          
          return `href="/docs/simple-cached?path=${targetPath}"`;
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