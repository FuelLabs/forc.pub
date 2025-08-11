// Simple search functionality test
async function testSearch() {
  console.log('🚀 Testing search functionality...');
  
  try {
    console.log('📄 Fetching documentation page...');
    const response = await fetch('http://localhost:3000/docs/pure?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`✅ Page loaded (${html.length} characters)`);
    
    // Test 1: Check for search input
    console.log('🔍 Test 1: Checking for search input...');
    if (!html.includes('id="search-input"')) {
      throw new Error('Search input element not found');
    }
    console.log('✅ Search input found');
    
    // Test 2: Check for search results container
    console.log('📊 Test 2: Checking for search results container...');
    if (!html.includes('id="search"')) {
      throw new Error('Search results container not found');
    }
    console.log('✅ Search results container found');
    
    // Test 3: Check for SEARCH_INDEX
    console.log('💾 Test 3: Checking for SEARCH_INDEX...');
    if (!html.includes('var SEARCH_INDEX=')) {
      throw new Error('SEARCH_INDEX not found');
    }
    console.log('✅ SEARCH_INDEX found');
    
    // Test 4: Check for search functions
    console.log('⚙️ Test 4: Checking for search functions...');
    const requiredFunctions = ['initSearch', 'performSearch', 'getSearchScore', 'displayResults'];
    for (const func of requiredFunctions) {
      if (!html.includes(func)) {
        throw new Error(`Function ${func} not found`);
      }
    }
    console.log('✅ All search functions found');
    
    // Test 5: Check for event listeners
    console.log('👂 Test 5: Checking for event listeners...');
    if (!html.includes('addEventListener')) {
      throw new Error('Event listeners not found');
    }
    console.log('✅ Event listeners found');
    
    // Test 6: Parse and validate SEARCH_INDEX structure
    console.log('🔧 Test 6: Validating SEARCH_INDEX structure...');
    const indexMatch = html.match(/var SEARCH_INDEX=(\{.*?\});/s);
    if (!indexMatch) {
      throw new Error('Could not extract SEARCH_INDEX');
    }
    
    try {
      const searchIndex = JSON.parse(indexMatch[1]);
      if (!searchIndex.std || !Array.isArray(searchIndex.std)) {
        throw new Error('SEARCH_INDEX.std is not an array');
      }
      
      const itemCount = searchIndex.std.length;
      console.log(`✅ SEARCH_INDEX has ${itemCount} items`);
      
      // Check for asset-related items
      const assetItems = searchIndex.std.filter(item => 
        item.name.toLowerCase().includes('asset') || 
        (item.module_info && item.module_info.includes('asset'))
      );
      
      if (assetItems.length === 0) {
        throw new Error('No asset-related items found in search index');
      }
      
      console.log(`✅ Found ${assetItems.length} asset-related items:`, 
        assetItems.slice(0, 3).map(item => item.name));
      
    } catch (parseError) {
      throw new Error(`Failed to parse SEARCH_INDEX: ${parseError.message}`);
    }
    
    console.log('🎉 All tests passed! Search functionality should work.');
    return true;
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  }
}

// Test the actual search logic
function testSearchLogic() {
  console.log('🧪 Testing search logic...');
  
  // Mock SEARCH_INDEX
  const SEARCH_INDEX = {
    std: [
      {
        name: "AssetId",
        type_name: "struct", 
        html_filename: "struct.AssetId.html",
        module_info: ["std", "asset_id"],
        preview: "An AssetId is used for interacting with an asset on the network."
      },
      {
        name: "mint",
        type_name: "function",
        html_filename: "fn.mint.html", 
        module_info: ["std", "asset"],
        preview: "Mint new tokens"
      },
      {
        name: "transfer", 
        type_name: "function",
        html_filename: "fn.transfer.html",
        module_info: ["std", "asset"], 
        preview: "Transfer assets"
      }
    ]
  };
  
  // Mock search scoring function (simplified version of what's in the HTML)
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
  
  // Test search for "asset"
  const query = "asset";
  const results = [];
  
  for (const crate in SEARCH_INDEX) {
    const items = SEARCH_INDEX[crate] || [];
    for (const item of items) {
      const score = getSearchScore(item, query);
      if (score > 0) {
        results.push({ ...item, score, crate });
      }
    }
  }
  
  results.sort((a, b) => b.score - a.score);
  
  console.log(`🔍 Search for "${query}" found ${results.length} results:`);
  results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.name} (${result.type_name}) - score: ${result.score}`);
  });
  
  if (results.length === 0) {
    throw new Error('Search logic returned no results');
  }
  
  console.log('✅ Search logic test passed');
  return true;
}

// Run tests
async function runAllTests() {
  try {
    const htmlTest = await testSearch();
    const logicTest = testSearchLogic();
    
    if (htmlTest && logicTest) {
      console.log('🎊 ALL TESTS PASSED! The search functionality should be working.');
      return true;
    } else {
      console.log('❌ Some tests failed.');
      return false;
    }
  } catch (error) {
    console.log(`❌ Test suite failed: ${error.message}`);
    return false;
  }
}

runAllTests();