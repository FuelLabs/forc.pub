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
    return docsCache.files;
  }
  
  // Cache is invalid, reload
  const files = loadAllDocsFromDisk();
  
  // Update cache
  docsCache = {
    files,
    timestamp: now,
  };
  
  return files;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filePath = params.path ? params.path.join('/') : 'std/index.html';
  
  try {
    const files = getOrLoadDocs();
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
    
    // For HTML files, rewrite paths to use clean URLs and fix search
    if (ext === 'html') {
      let html = content;
      
      // Rewrite static file paths
      html = html.replace(
        /href="\.\.\/static\.files\/([^"]+)"/g,
        (match, filename) => `href="/docs/static.files/${filename}"`
      );
      html = html.replace(
        /src="\.\.\/static\.files\/([^"]+)"/g,
        (match, filename) => `src="/docs/static.files/${filename}"`
      );
      
      // Rewrite search.js path
      html = html.replace(
        /src="\.\.\/search\.js"/g,
        'src="/docs/search.js"'
      );
      
      // COMPLETELY REMOVE ALL JAVASCRIPT INCLUDING EXTERNAL SEARCH.JS
      // Remove all existing JavaScript
      html = html.replace(/<script[\s\S]*?<\/script>/g, '');
      
      // Remove the old onsubmit handler from the form
      html = html.replace(/onsubmit="[^"]*"/g, '');
      
      // Get SEARCH_INDEX directly from our files
      const searchJsContent = files.get('search.js');
      let searchIndexCode = '';
      if (searchJsContent) {
        let actualSearchJS = searchJsContent;
        if (searchJsContent.includes(',') && /^\d+,\d+/.test(searchJsContent.substring(0, 10))) {
          const byteCodes = searchJsContent.split(',').map(num => parseInt(num.trim()));
          actualSearchJS = String.fromCharCode(...byteCodes);
        }
        searchIndexCode = actualSearchJS;
      }
      
      // Add ONLY our working search implementation with SEARCH_INDEX inline
      html = html.replace(
        '</head>',
        `<script>
console.log('🔍 Initializing search...');

// Inline SEARCH_INDEX to avoid WebAssembly issues
${searchIndexCode}

console.log('✅ SEARCH_INDEX loaded:', typeof SEARCH_INDEX !== 'undefined');

document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM loaded, setting up search...');
  
  const searchInput = document.getElementById('search-input');
  const searchSection = document.getElementById('search');
  const mainSection = document.getElementById('main-content');
  
  if (!searchInput || !searchSection || !mainSection) {
    console.error('❌ Elements missing:', {
      searchInput: !!searchInput,
      searchSection: !!searchSection,
      mainSection: !!mainSection
    });
    return;
  }
  
  console.log('✅ All elements found');
  
  function performSearch(query) {
    console.log('🔍 Searching for:', query);
    
    if (!query || !query.trim()) {
      searchSection.innerHTML = '';
      searchSection.setAttribute('class', 'search-results hidden');
      searchSection.style.display = 'none';
      mainSection.setAttribute('class', 'content');
      mainSection.style.display = 'block';
      return;
    }
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const crate in SEARCH_INDEX) {
      const items = SEARCH_INDEX[crate] || [];
      for (const item of items) {
        const name = item.name.toLowerCase();
        if (name.includes(queryLower)) {
          results.push(item);
        }
      }
    }
    
    results.sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(queryLower);
      const bStartsWith = b.name.toLowerCase().startsWith(queryLower);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.name.localeCompare(b.name);
    });
    
    const topResults = results.slice(0, 20);
    console.log('📊 Found', topResults.length, 'results');
    
    if (topResults.length === 0) {
      searchSection.innerHTML = '<h1>Results for ' + query + '</h1><p>No results found.</p>';
    } else {
      const resultsHtml = topResults.map(item => {
        const formattedName = '<span class="type ' + (item.type_name || '') + '">' + item.name + '</span>';
        const name = item.type_name === "module" 
          ? [...(item.module_info || []).slice(0,-1), formattedName].join("::")
          : [...(item.module_info || []), formattedName].join("::");
        
        // Build correct path using module_info
        const modulePath = (item.module_info || []).slice(1).join('/'); // Remove 'std' and join rest
        const path = modulePath 
          ? '/docs/' + item.module_info.join('/') + '/' + item.html_filename
          : '/docs/std/' + item.html_filename;
        
        const left = '<td><span>' + name + '</span></td>';
        const right = '<td><p>' + (item.preview || '') + '</p></td>';
        return '<tr onclick="window.location=\\'' + path + '\\';">' + left + right + '</tr>';
      }).join('');
      
      searchSection.innerHTML = '<h1>Results for ' + query + '</h1><table>' + resultsHtml + '</table>';
    }
    
    searchSection.setAttribute('class', 'search-results');
    searchSection.style.display = 'block';
    mainSection.setAttribute('class', 'content hidden');
    mainSection.style.display = 'none';
  }
  
  // Set up live search
  searchInput.addEventListener('input', function(e) {
    console.log('⌨️ Input:', e.target.value);
    performSearch(e.target.value);
  });
  
  // Prevent form submission
  const form = document.getElementById('search-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      return false;
    });
  }
  
  // Escape key to clear
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchSection.innerHTML = '';
      searchSection.setAttribute('class', 'search-results hidden');
      searchSection.style.display = 'none';
      mainSection.setAttribute('class', 'content');
      mainSection.style.display = 'block';
    }
  });
  
  console.log('🎉 Search setup complete!');
});
</script></head>`
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
          
          return `href="/docs/${targetPath}"`;
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
    console.error('Error serving docs:', error);
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