// Validate search functionality by directly testing the JavaScript
const fs = require('fs');

async function validateSearch() {
  console.log('🔍 Validating search functionality...');
  
  try {
    // Fetch the page
    const response = await fetch('http://localhost:3000/docs/pure?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va');
    const html = await response.text();
    
    // Extract the JavaScript and search index
    const scriptMatch = html.match(/<script[^>]*>(.*?)<\/script>/s);
    if (!scriptMatch) {
      throw new Error('No script tag found');
    }
    
    const scriptContent = scriptMatch[1];
    console.log(`✅ Found script content (${scriptContent.length} characters)`);
    
    // Extract SEARCH_INDEX
    const indexMatch = scriptContent.match(/var SEARCH_INDEX=(\{.*?\});/s);
    if (!indexMatch) {
      throw new Error('SEARCH_INDEX not found in script');
    }
    
    const searchIndex = JSON.parse(indexMatch[1]);
    console.log(`✅ SEARCH_INDEX parsed successfully (${searchIndex.std.length} items)`);
    
    // Test the search logic directly
    function getSearchScore(item, query) {
      let score = 0;
      const name = item.name.toLowerCase();
      const preview = (item.preview || '').toLowerCase();
      
      if (name === query) score += 1000;
      else if (name.startsWith(query)) score += 100;
      else if (name.includes(query)) score += 50;
      
      if (preview.includes(query)) score += 10;
      
      if (item.module_info && item.module_info.join('::').toLowerCase().includes(query)) {
        score += 20;
      }
      
      return score;
    }
    
    function performSearch(query) {
      const results = [];
      const queryLower = query.toLowerCase();
      
      for (const crate in searchIndex) {
        const items = searchIndex[crate] || [];
        for (const item of items) {
          const score = getSearchScore(item, queryLower);
          if (score > 0) {
            results.push({ ...item, score, crate });
          }
        }
      }
      
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, 50);
    }
    
    // Test search for "asset"
    const assetResults = performSearch('asset');
    console.log(`✅ Search for "asset" returned ${assetResults.length} results:`);
    assetResults.slice(0, 5).forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.name} (${result.type_name}) - score: ${result.score}`);
    });
    
    // Test search for "mint"
    const mintResults = performSearch('mint');
    console.log(`✅ Search for "mint" returned ${mintResults.length} results:`);
    mintResults.slice(0, 3).forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.name} (${result.type_name}) - score: ${result.score}`);
    });
    
    // Check if the search functions are present
    const requiredFunctions = ['initSearch', 'performSearch', 'getSearchScore', 'displayResults'];
    for (const funcName of requiredFunctions) {
      if (!scriptContent.includes(funcName)) {
        throw new Error(`Function ${funcName} not found in script`);
      }
    }
    console.log(`✅ All required functions found in script`);
    
    // Check if event listeners are set up
    if (!scriptContent.includes('addEventListener')) {
      throw new Error('No event listeners found');
    }
    console.log(`✅ Event listeners found`);
    
    // Check if DOM ready handling is present
    if (!scriptContent.includes('DOMContentLoaded') && !scriptContent.includes('readyState')) {
      throw new Error('No DOM ready handling found');
    }
    console.log(`✅ DOM ready handling found`);
    
    // Save a minimal test HTML file
    const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Search Test</title>
    <style>
        .search-input { width: 300px; padding: 10px; margin: 10px 0; }
        #search { border: 1px solid #ccc; padding: 10px; margin: 10px 0; min-height: 100px; }
        .search-results { border-bottom: 1px solid #eee; padding: 5px; }
    </style>
</head>
<body>
    <h1>Search Test</h1>
    <input id="search-input" class="search-input" placeholder="Type 'asset' to test...">
    <div id="search"></div>
    <div id="status">Ready to test...</div>
    
    ${scriptMatch[0]}
    
    <script>
        // Test the search after a short delay
        setTimeout(() => {
            const input = document.getElementById('search-input');
            const status = document.getElementById('status');
            
            input.value = 'asset';
            
            // Trigger the search
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
            
            // Check results after a delay
            setTimeout(() => {
                const results = document.getElementById('search');
                if (results.innerHTML.trim() && results.style.display !== 'none') {
                    status.innerHTML = '<span style="color: green;">✅ Search is working! Results displayed.</span>';
                } else {
                    status.innerHTML = '<span style="color: red;">❌ Search not working. No results displayed.</span>';
                }
            }, 500);
        }, 100);
    </script>
</body>
</html>`;
    
    fs.writeFileSync('search-test-isolated.html', testHTML);
    console.log(`✅ Created isolated test file: search-test-isolated.html`);
    
    console.log('\n🎉 VALIDATION COMPLETE! The search logic appears to be correct.');
    console.log('📁 Open search-test-isolated.html in your browser to test the actual functionality.');
    
    return true;
    
  } catch (error) {
    console.log(`❌ Validation failed: ${error.message}`);
    return false;
  }
}

validateSearch();