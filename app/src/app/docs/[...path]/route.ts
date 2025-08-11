import { NextRequest, NextResponse } from "next/server";
import { getPackageDetail } from "../../../features/docs/lib/api";
import { extractDocFromIPFS } from "../../../features/docs/lib/ipfs";
import fs from 'fs';
import path from 'path';

// In-memory cache - persists for the lifetime of the server process
interface DocsCache {
  files: Map<string, string>;
  timestamp: number;
  ipfsHash: string;
}

const packageCaches = new Map<string, DocsCache>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const LOCAL_DOCS_PATH = '/Users/joshuabatty/Documents/rust/fuel/sway/sway-lib-std/out/doc';

async function loadAllDocsFromDisk(): Promise<Map<string, string>> {
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
          
          // Normalize file paths for std package to match published package structure
          // Remove 'std/' prefix from HTML files to make paths consistent
          let normalizedPath = relativePath;
          if (normalizedPath.startsWith('std/') && (normalizedPath.endsWith('.html'))) {
            normalizedPath = normalizedPath.substring(4); // Remove 'std/' prefix
          }
          
          files.set(normalizedPath, content);
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

async function loadAllDocsFromIPFS(ipfsHash: string): Promise<Map<string, string>> {
  console.log(`Loading all docs from IPFS ${ipfsHash}...`);
  const files = new Map<string, string>();
  
  // We need to extract all files from the IPFS tarball
  // This requires modifying the extractDocFromIPFS function or creating a new one
  // For now, let's implement a simplified version that extracts all files
  
  const { extractAllFromTarball } = await import('../../../features/docs/lib/ipfs');
  const allFiles = await extractAllFromTarball(ipfsHash);
  
  for (const [filePath, content] of allFiles.entries()) {
    files.set(filePath, content);
  }
  
  console.log(`Loaded ${files.size} files from IPFS into memory cache`);
  return files;
}

async function getOrLoadDocs(packageName: string, version: string): Promise<Map<string, string>> {
  const cacheKey = `${packageName}@${version}`;
  const now = Date.now();
  
  // Check if cache is valid
  const existing = packageCaches.get(cacheKey);
  if (existing && (now - existing.timestamp) < CACHE_DURATION) {
    console.log(`Using cached docs for ${cacheKey}`);
    return existing.files;
  }
  
  // Cache is invalid or doesn't exist, reload
  console.log(`Loading fresh docs for ${cacheKey}`);
  
  // Special case for "std" package - use local files for testing
  if (packageName === 'std') {
    const files = await loadAllDocsFromDisk();
    packageCaches.set(cacheKey, {
      files,
      timestamp: now,
      ipfsHash: 'local',
    });
    return files;
  }
  
  // For real packages, get from IPFS
  try {
    // Get package details to find IPFS hash
    const packageData = await getPackageDetail(packageName, version);
    if (!packageData.docsIpfsUrl) {
      throw new Error(`No documentation available for ${packageName}@${version}`);
    }
    
    // Extract IPFS hash from URL
    const ipfsHashMatch = packageData.docsIpfsUrl.match(/\/ipfs\/([^/?]+)/);
    if (!ipfsHashMatch) {
      throw new Error(`Invalid IPFS URL format: ${packageData.docsIpfsUrl}`);
    }
    const ipfsHash = ipfsHashMatch[1];
    
    // Load all files from IPFS
    const files = await loadAllDocsFromIPFS(ipfsHash);
    
    // Update cache
    packageCaches.set(cacheKey, {
      files,
      timestamp: now,
      ipfsHash,
    });
    
    return files;
  } catch (error) {
    console.error(`Failed to load package ${cacheKey}:`, error);
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  
  // Parse URL structure: /docs/[packageName]/[version]/[...docPath] or /docs/[packageName]/[...docPath]
  const pathSegments = params.path || [];
  
  if (pathSegments.length < 1) {
    return new NextResponse('Package name required', { status: 400 });
  }
  
  const packageName = pathSegments[0];
  let version: string;
  let docPath: string[];
  
  // Check if second segment looks like a version (contains dots, numbers, or common version patterns)
  const secondSegment = pathSegments[1];
  const isVersion = secondSegment && (/^\d+\.\d+/.test(secondSegment) || secondSegment === 'latest');
  
  if (isVersion) {
    version = secondSegment;
    docPath = pathSegments.slice(2);
  } else {
    // No version specified, get latest version or use default for std
    if (packageName === 'std') {
      version = 'latest';
      docPath = pathSegments.slice(1);
    } else {
      try {
        const { getLatestVersion } = await import('../../../features/docs/lib/api');
        version = await getLatestVersion(packageName);
        docPath = pathSegments.slice(1);
      } catch (error) {
        console.error(`Failed to get latest version for ${packageName}:`, error);
        return new NextResponse(`Package not found: ${packageName}`, { status: 404 });
      }
    }
  }
  
  // Default to index.html if no file path specified
  const filePath = docPath.length > 0 ? docPath.join('/') : 'index.html';
  
  try {
    const files = await getOrLoadDocs(packageName, version);
    const content = files.get(filePath);
    
    if (!content) {
      console.error(`File not found: ${filePath} in package ${packageName}@${version}`);
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
        (match, filename) => `href="/docs/${packageName}/${version}/static.files/${filename}"`
      );
      html = html.replace(
        /src="\.\.\/static\.files\/([^"]+)"/g,
        (match, filename) => `src="/docs/${packageName}/${version}/static.files/${filename}"`
      );
      
      // Rewrite search.js path
      html = html.replace(
        /src="\.\.\/search\.js"/g,
        `src="/docs/${packageName}/${version}/search.js"`
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
        
        // Build correct path using module_info and current package context
        // Remove the first element from module_info if it matches the package name
        let modulePathArray = item.module_info || [];
        if (modulePathArray.length > 0 && modulePathArray[0] === packageName) {
          modulePathArray = modulePathArray.slice(1);
        }
        const modulePath = modulePathArray.join('/');
        const path = modulePath 
          ? '/docs/${packageName}/${version}/' + modulePath + '/' + item.html_filename
          : '/docs/${packageName}/${version}/' + item.html_filename;
        
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
          
          return `href="/docs/${packageName}/${version}/${targetPath}"`;
        }
      );
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': packageCaches.has(`${packageName}@${version}`) ? 'HIT' : 'MISS',
        },
      });
    }
    
    // For non-HTML files, serve as-is
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24 hours for static assets
        'X-Cache': packageCaches.has(`${packageName}@${version}`) ? 'HIT' : 'MISS',
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const pathSegments = params.path || [];
  
  if (pathSegments.length >= 1) {
    const packageName = pathSegments[0];
    const version = pathSegments[1];
    
    if (version) {
      // Flush specific package version
      const cacheKey = `${packageName}@${version}`;
      packageCaches.delete(cacheKey);
      console.log(`Cache flushed for ${cacheKey}`);
      return new NextResponse(`Cache flushed for ${cacheKey}`, { status: 200 });
    } else {
      // Flush all versions of this package
      const keysToDelete = Array.from(packageCaches.keys()).filter(key => key.startsWith(`${packageName}@`));
      for (const key of keysToDelete) {
        packageCaches.delete(key);
      }
      console.log(`Cache flushed for all versions of ${packageName}`);
      return new NextResponse(`Cache flushed for all versions of ${packageName}`, { status: 200 });
    }
  } else {
    // Flush entire cache
    packageCaches.clear();
    console.log('All docs cache flushed');
    return new NextResponse('All docs cache flushed', { status: 200 });
  }
}