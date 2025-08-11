import { NextRequest, NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

// Serve the locally generated sway-lib-std documentation
const DOC_ROOT = '/Users/joshuabatty/Documents/rust/fuel/sway/sway-lib-std/out/doc';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const requestPath = params.path ? params.path.join('/') : 'std/index.html';
  const filePath = path.join(DOC_ROOT, requestPath);

  try {
    console.log(`Local docs - Serving ${requestPath} from ${filePath}`);
    
    // Security check - ensure we're not serving files outside DOC_ROOT
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(DOC_ROOT);
    if (!resolvedPath.startsWith(resolvedRoot)) {
      return new NextResponse('Access denied', { status: 403 });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return new NextResponse('File not found', { status: 404 });
    }

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.html':
        contentType = 'text/html; charset=utf-8';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.woff2':
        contentType = 'font/woff2';
        break;
    }

    // Read and serve the file
    const content = fs.readFileSync(filePath, 'utf8');
    
    // For HTML files, rewrite links to use our route
    if (ext === '.html') {
      let processedHtml = content;
      
      // Rewrite relative links to use our routing
      processedHtml = processedHtml.replace(
        /href="([^"]+)"/g,
        (match, href) => {
          if (href.startsWith('http') || href.startsWith('#') || href.startsWith('/')) {
            return match;
          }
          
          // Convert relative paths to our route
          let targetPath = href;
          if (href.startsWith('../')) {
            // Handle ../static.files/ and ../search.js
            targetPath = href.substring(3); // Remove ../
          } else {
            // Handle same-directory links
            const currentDir = requestPath.substring(0, requestPath.lastIndexOf('/'));
            if (currentDir && currentDir !== requestPath) {
              targetPath = currentDir + '/' + href;
            }
          }
          
          return `href="/docs/local/${targetPath}"`;
        }
      );
      
      processedHtml = processedHtml.replace(
        /src="([^"]+)"/g,
        (match, src) => {
          if (src.startsWith('http') || src.startsWith('/')) {
            return match;
          }
          
          let targetPath = src;
          if (src.startsWith('../')) {
            targetPath = src.substring(3);
          }
          
          return `src="/docs/local/${targetPath}"`;
        }
      );
      
      return new NextResponse(processedHtml, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error serving local docs:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}