import { NextRequest, NextResponse } from "next/server";
import { getPackageDetail, getLatestVersion } from "../../../features/docs/lib/api";
import { 
  validatePackageName, 
  validateVersion, 
  validateFilePath,
  checkRateLimit,
  generateCSPNonce,
  SecurityValidationError 
} from "../../../features/docs/lib/security";
import {
  getCachedPackageDocs,
  setCachedPackageDocs,
  evictPackageFromCache,
  evictAllPackageVersionsFromCache,
  clearAllCaches
} from "../../../features/docs/lib/cache";
import {
  logError,
  createRateLimitResponse
} from "../../../features/docs/lib/errors";
import { extractAllFromTarball } from "../../../features/docs/lib/fetching";
import { getContentType, isHtmlFile } from "../../../features/docs/lib/utils";

// Cache interface for documentation (matches cache.ts interface)
interface DocsCache {
  files: Map<string, string>;
  timestamp: number;
  ipfsHash: string;
}

/// Loads all documentation files from IPFS or S3 with security and caching
async function loadAllDocsFromStorage(ipfsHash: string): Promise<Map<string, string>> {
  try {
    const allFiles = await extractAllFromTarball(ipfsHash);
    console.log(`Extracted ${allFiles.size} files from storage: ${ipfsHash}`);
    return allFiles;
  } catch (error) {
    logError('Storage extraction failed', error, { ipfsHash });
    throw error;
  }
}

/// Gets or loads documentation with LRU caching
async function getOrLoadDocs(packageName: string, version: string): Promise<Map<string, string>> {
  // Check LRU cache first
  const cached = getCachedPackageDocs(packageName, version);
  if (cached) {
    console.log(`Using cached docs for ${packageName}@${version}`);
    return cached.files;
  }
  
  console.log(`Loading fresh docs for ${packageName}@${version}`);
  
  // Get from IPFS
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
    
    // Load all files from storage
    const files = await loadAllDocsFromStorage(ipfsHash);
    
    // Update LRU cache
    const cacheEntry: DocsCache = {
      files,
      timestamp: Date.now(),
      ipfsHash,
    };
    setCachedPackageDocs(packageName, version, cacheEntry);
    
    return files;
  } catch (error) {
    logError(`Failed to load package ${packageName}@${version}`, error, { packageName, version });
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Get client IP for rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  // Apply rate limiting
  if (!checkRateLimit(clientIp)) {
    const response = createRateLimitResponse();
    return new NextResponse(response.message, { 
      status: response.status,
      headers: response.headers
    });
  }
  
  try {
    // Parse URL structure: /docs/[packageName]/[version]/[...docPath] or /docs/[packageName]/[...docPath]
    const pathSegments = params.path || [];
    
    if (pathSegments.length < 1) {
      return new NextResponse('Package name required', { status: 400 });
    }
    
    // Validate package name
    const packageName = validatePackageName(pathSegments[0]);
    let version: string;
    let docPath: string[];
  
    // Check if second segment looks like a version (contains dots, numbers, or common version patterns)
    const secondSegment = pathSegments[1];
    const isVersion = secondSegment && (/^\d+\.\d+/.test(secondSegment) || secondSegment === 'latest');
    
    if (isVersion) {
      version = validateVersion(secondSegment);
      docPath = pathSegments.slice(2);
    } else {
      // No version specified, get latest version
      try {
        version = await getLatestVersion(packageName);
        docPath = pathSegments.slice(1);
      } catch (error) {
        logError(`Package not found: ${packageName}`, error);
        return new NextResponse('Package not found', { status: 404 });
      }
    }
    
    // Validate and sanitize file path
    const requestedPath = docPath.length > 0 ? docPath.join('/') : 'index.html';
    const filePath = validateFilePath(requestedPath);
  
    const files = await getOrLoadDocs(packageName, version);
    const content = files.get(filePath);
    
    if (!content) {
      logError(`File not found: ${filePath}`, new Error('File not found'), { 
        packageName, 
        version, 
        filePath,
        availableFiles: Array.from(files.keys()).slice(0, 10)
      });
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Determine content type
    const contentType = getContentType(filePath);
    
    // Generate CSP nonce for inline scripts
    const nonce = generateCSPNonce();
    
    // For HTML files, rewrite paths to use clean URLs and fix search
    if (isHtmlFile(filePath)) {
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
          'Content-Security-Policy': `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';`,
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      });
    }
    
    // For non-HTML files, serve as-is with security headers

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24 hours for static assets
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
    
  } catch (error) {
    logError('Documentation route error', error);
    
    // Handle specific error types
    if (error instanceof SecurityValidationError) {
      return new NextResponse(`Validation error: ${error.message}`, { status: 400 });
    }
    
    // Generic error response
    return new NextResponse('Internal server error', { status: 500 });
  }
}

/// Cache management endpoint with security controls
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Get client IP for rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  // Apply rate limiting
  if (!checkRateLimit(clientIp)) {
    return new NextResponse('Too many requests', { 
      status: 429,
      headers: {
        'Retry-After': '60'
      }
    });
  }
  
  try {
    const pathSegments = params.path || [];
    
    if (pathSegments.length >= 1) {
      const packageName = validatePackageName(pathSegments[0]);
      
      if (pathSegments.length >= 2) {
        const version = validateVersion(pathSegments[1]);
        
        const deleted = evictPackageFromCache(packageName, version);
        if (deleted) {
          console.log(`Cache flushed for ${packageName}@${version}`);
          return new NextResponse(`Cache flushed for ${packageName}@${version}`, { status: 200 });
        } else {
          return new NextResponse('Cache entry not found', { status: 404 });
        }
      } else {
        // Flush all versions of this package
        const evictedCount = evictAllPackageVersionsFromCache(packageName);
        console.log(`Cache flushed for all versions of ${packageName} (${evictedCount} entries)`);
        return new NextResponse(
          `Cache flushed for all versions of ${packageName} (${evictedCount} entries)`, 
          { status: 200 }
        );
      }
    } else {
      // Flush entire cache (admin operation - could add auth check here)
      clearAllCaches();
      console.log('All docs cache flushed');
      return new NextResponse('All docs cache flushed', { status: 200 });
    }
  } catch (error) {
    logError('Error flushing cache', error);
    
    if (error instanceof SecurityValidationError) {
      return new NextResponse(`Validation error: ${error.message}`, { status: 400 });
    }
    
    return new NextResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}