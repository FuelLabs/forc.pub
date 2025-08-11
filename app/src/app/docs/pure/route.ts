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
  const searchQuery = searchParams.get('search');


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
    console.log(`Processing request for ipfsHash: ${ipfsHash}, filePath: ${filePath}`);
    
    // Extract all files from tarball in ONE operation
    const allFiles = await extractAllFromIPFS(ipfsHash);
    
    // Get the HTML file
    const docContent = allFiles[filePath];
    if (!docContent) {
      console.error(`File ${filePath} not found in tarball`);
      console.log(`Available files:`, Object.keys(allFiles).slice(0, 20));
      throw new Error(`File ${filePath} not found in tarball`);
    }
    
    console.log(`Successfully found ${filePath}, content length: ${docContent.length}`);
    
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
    
    // Fix internal documentation links to point to our pure route
    processedContent = processedContent.replace(
      /href="([^"]+\.html)"/g,
      (match, href) => {
        try {
          // Skip external links (http/https) and anchors (#)
          if (href.startsWith('http') || href.startsWith('#') || href.includes('://')) {
            return match;
          }
          
          // Convert relative paths to absolute within the docs
          let docPath = href;
          
          // Handle relative paths like "../option/index.html"
          if (href.startsWith('../')) {
            // Remove leading ../ and resolve relative to current file
            const currentDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
            const relativeParts = href.split('/').filter(part => part !== '');
            const pathParts = currentDir ? currentDir.split('/').filter(part => part !== '') : [];
            
            for (const part of relativeParts) {
              if (part === '..') {
                if (pathParts.length > 0) {
                  pathParts.pop(); // Go up one directory
                }
              } else if (part !== '.') {
                pathParts.push(part);
              }
            }
            
            docPath = pathParts.join('/');
          } else if (!href.startsWith('http') && !href.startsWith('/') && !href.startsWith('#')) {
            // Handle relative paths within the same directory (like "struct.Address.html" or "fn.mint_to.html")
            const currentDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
            if (currentDir) {
              docPath = currentDir + '/' + href;
            } else {
              // If no current directory and it's a simple relative path, prepend 'std/'
              docPath = 'std/' + href;
            }
          }
          
          // Ensure path doesn't start with /
          docPath = docPath.replace(/^\/+/, '');
          
          // Don't rewrite if path is empty
          if (!docPath) {
            return match;
          }
          
          // Only prepend 'std/' if the path doesn't already start with it AND we haven't already processed it above
          if (!docPath.startsWith('std/') && !filePath.includes('/')) {
            docPath = 'std/' + docPath;
          }
          
          console.log(`Rewriting link: "${href}" (from ${filePath}) -> /docs/pure?ipfs=${ipfsHash}&file=${docPath}`);
          return `href="/docs/pure?ipfs=${ipfsHash}&file=${docPath}"`;
        } catch (error) {
          console.error('Error rewriting link:', href, error);
          return match; // Return original if there's an error
        }
      }
    );

    // Replace all CSS link tags with one inline style block
    processedContent = processedContent.replace(
      /<link[^>]*rel="stylesheet"[^>]*>/gi, 
      ''
    );
    
    // Get and inline the search.js file
    let searchJS = '';
    const searchJSContent = allFiles['search.js'];
    if (searchJSContent) {
      let actualSearchJS = searchJSContent;
      if (searchJSContent.includes(',') && /^\d+,\d+/.test(searchJSContent.substring(0, 10))) {
        const byteCodes = searchJSContent.split(',').map(num => parseInt(num.trim()));
        actualSearchJS = String.fromCharCode(...byteCodes);
      }
      searchJS = actualSearchJS;
    }

    // Insert the combined CSS into the head
    processedContent = processedContent.replace(
      '</head>',
      `<style>${allInlineCSS}</style></head>`
    );

    // Basic sanitization - remove scripts but keep everything else
    processedContent = processedContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    processedContent = processedContent.replace(/<script[^>]*\/>/gi, '');
    processedContent = processedContent.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Add search functionality after sanitization
    const searchFunctionality = `
      ${searchJS}
      
      // Search functionality
      function initSearch() {
        console.log('initSearch called');
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search');
        
        console.log('Search input:', searchInput);
        console.log('Search results container:', searchResults);
        console.log('SEARCH_INDEX defined:', typeof SEARCH_INDEX !== 'undefined');
        
        if (!searchInput || !searchResults || typeof SEARCH_INDEX === 'undefined') {
          console.error('Search initialization failed:', {
            searchInput: !!searchInput,
            searchResults: !!searchResults,
            SEARCH_INDEX: typeof SEARCH_INDEX !== 'undefined'
          });
          return;
        }
        
        console.log('Search initialized successfully');
        
        let currentResults = [];
        
        function performSearch(query) {
          console.log('performSearch called with query:', query);
          
          if (!query.trim()) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
          }
          
          const results = [];
          const queryLower = query.toLowerCase();
          console.log('Searching for:', queryLower);
          
          // Search through all items in the index
          for (const crate in SEARCH_INDEX) {
            const items = SEARCH_INDEX[crate] || [];
            for (const item of items) {
              const score = getSearchScore(item, queryLower);
              if (score > 0) {
                results.push({ ...item, score, crate });
              }
            }
          }
          
          // Sort by relevance score
          results.sort((a, b) => b.score - a.score);
          
          // Take top 50 results
          currentResults = results.slice(0, 50);
          displayResults(currentResults);
        }
        
        function getSearchScore(item, query) {
          let score = 0;
          const name = item.name.toLowerCase();
          const preview = (item.preview || '').toLowerCase();
          
          // Exact name match gets highest score
          if (name === query) score += 1000;
          else if (name.startsWith(query)) score += 100;
          else if (name.includes(query)) score += 50;
          
          // Preview text matches
          if (preview.includes(query)) score += 10;
          
          // Module path matches
          if (item.module_info && item.module_info.join('::').toLowerCase().includes(query)) {
            score += 20;
          }
          
          return score;
        }
        
        function displayResults(results) {
          if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-failed active"><p>No results found.</p></div>';
            searchResults.style.display = 'block';
            return;
          }
          
          const resultsHtml = results.map(item => {
            const modulePath = item.module_info ? item.module_info.join('::') : '';
            const typeClass = item.type_name ? item.type_name.toLowerCase() : '';
            const url = '/docs/pure?ipfs=${ipfsHash}&file=std/' + item.html_filename;
            
            return '<div class="search-results"><table><tr onclick="window.location=\'' + url + '\'"><td><span class="type ' + typeClass + '">' + (item.type_name || '') + '</span><strong>' + item.name + '</strong><div class="desc">' + modulePath + '</div></td><td><div class="desc">' + (item.preview || '') + '</div></td></tr></table></div>';
          }).join('');
          
          searchResults.innerHTML = resultsHtml;
          searchResults.style.display = 'block';
        }
        
        // Prevent form submission
        const searchForm = document.getElementById('search-form');
        if (searchForm) {
          searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            return false;
          });
        }
        
        // Handle search input
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            performSearch(e.target.value);
          }, 150);
        });
        
        // Handle escape key to clear search and prevent Enter from submitting
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            searchInput.value = '';
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
          } else if (e.key === 'Enter') {
            e.preventDefault();
            return false;
          }
        });
        
        // Handle clicks outside to close search
        document.addEventListener('click', (e) => {
          if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
          }
        });
      }
      
      // Initialize search when DOM is ready - wrapped to prevent other errors from breaking it
      function safeInit() {
        try {
          initSearch();
        } catch (error) {
          console.error('Error initializing search:', error);
        }
      }
      
      // Try multiple initialization methods to ensure it runs
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInit);
      } else {
        safeInit();
      }
      
      // Fallback: Also try after a delay
      setTimeout(safeInit, 100);
      
      // Another fallback: on window load
      window.addEventListener('load', safeInit);
      
      // Force initialization even if other scripts fail
      (function() {
        console.log('[Search] Attempting immediate initialization...');
        try {
          // Check if elements exist right now
          const hasInput = !!document.getElementById('search-input');
          const hasContainer = !!document.getElementById('search');
          const hasIndex = typeof SEARCH_INDEX !== 'undefined';
          
          console.log('[Search] Immediate check:', {
            hasInput,
            hasContainer, 
            hasIndex
          });
          
          if (hasInput && hasContainer && hasIndex) {
            console.log('[Search] All requirements met, initializing now!');
            safeInit();
          } else {
            console.log('[Search] Requirements not met, will retry...');
          }
        } catch (e) {
          console.error('[Search] Immediate init error:', e);
        }
      })();
    `;
    
    processedContent = processedContent.replace(
      '</head>',
      `<script>${searchFunctionality}</script></head>`
    );

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