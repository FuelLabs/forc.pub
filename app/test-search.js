const puppeteer = require('puppeteer');

async function testSearch() {
  console.log('🚀 Starting search functionality test...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for CI
    devtools: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      console.log(`🖥️  Page console: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.log(`❌ Page error: ${error.message}`);
    });
    
    console.log('📄 Loading documentation page...');
    await page.goto('http://localhost:3000/docs/pure?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Test 1: Check if search input exists
    console.log('🔍 Test 1: Checking if search input exists...');
    const searchInput = await page.$('#search-input');
    if (!searchInput) {
      throw new Error('Search input not found');
    }
    console.log('✅ Search input exists');
    
    // Test 2: Check if SEARCH_INDEX is loaded
    console.log('📊 Test 2: Checking if SEARCH_INDEX is loaded...');
    const hasSearchIndex = await page.evaluate(() => {
      return typeof window.SEARCH_INDEX !== 'undefined' && window.SEARCH_INDEX !== null;
    });
    if (!hasSearchIndex) {
      throw new Error('SEARCH_INDEX not loaded');
    }
    console.log('✅ SEARCH_INDEX is loaded');
    
    // Test 3: Type in search box and check for results
    console.log('⌨️  Test 3: Typing "asset" in search box...');
    await page.type('#search-input', 'asset');
    
    // Wait a moment for debounced search
    await page.waitForTimeout(500);
    
    // Check if search results appear
    const searchResults = await page.$('#search');
    if (!searchResults) {
      throw new Error('Search results container not found');
    }
    
    const resultsVisible = await page.evaluate(() => {
      const results = document.getElementById('search');
      return results && (results.style.display !== 'none') && results.innerHTML.trim() !== '';
    });
    
    if (!resultsVisible) {
      // Log current state for debugging
      const searchState = await page.evaluate(() => {
        return {
          inputValue: document.getElementById('search-input')?.value,
          resultsHTML: document.getElementById('search')?.innerHTML,
          resultsDisplay: document.getElementById('search')?.style.display,
          hasSearchIndex: typeof window.SEARCH_INDEX !== 'undefined',
          indexKeys: typeof window.SEARCH_INDEX !== 'undefined' ? Object.keys(window.SEARCH_INDEX) : null,
          indexItemCount: typeof window.SEARCH_INDEX !== 'undefined' && window.SEARCH_INDEX.std ? window.SEARCH_INDEX.std.length : null
        };
      });
      console.log('🐛 Debug info:', JSON.stringify(searchState, null, 2));
      throw new Error('No search results appeared');
    }
    
    console.log('✅ Search results appeared');
    
    // Test 4: Check if results are clickable and contain "asset"
    console.log('🎯 Test 4: Checking if results contain asset-related items...');
    const assetResults = await page.evaluate(() => {
      const results = document.getElementById('search');
      return results.innerHTML.toLowerCase().includes('asset');
    });
    
    if (!assetResults) {
      throw new Error('Search results do not contain asset-related items');
    }
    console.log('✅ Search results contain asset-related items');
    
    // Test 5: Try clicking a result
    console.log('👆 Test 5: Testing click functionality...');
    const clickableResult = await page.$('#search tr');
    if (clickableResult) {
      // Get the URL before clicking
      const href = await page.evaluate(() => {
        const firstRow = document.querySelector('#search tr');
        return firstRow ? firstRow.onclick.toString() : null;
      });
      console.log('✅ Search result is clickable:', href !== null);
    }
    
    console.log('🎉 All search tests passed!');
    return true;
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  } finally {
    await browser.close();
  }
}

// Check if puppeteer is available
async function checkPuppeteer() {
  try {
    require('puppeteer');
    return true;
  } catch (e) {
    console.log('📦 Installing puppeteer...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install puppeteer', { stdio: 'inherit', cwd: __dirname });
      return true;
    } catch (installError) {
      console.log('❌ Failed to install puppeteer. Please install it manually: npm install puppeteer');
      return false;
    }
  }
}

// Simple fallback test without puppeteer
async function simpleFetchTest() {
  console.log('🚀 Running simple fetch test...');
  
  try {
    const response = await fetch('http://localhost:3000/docs/pure?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va');
    const html = await response.text();
    
    console.log('📄 Page loaded successfully');
    
    // Check for search input
    if (!html.includes('id="search-input"')) {
      throw new Error('Search input not found in HTML');
    }
    console.log('✅ Search input found in HTML');
    
    // Check for SEARCH_INDEX
    if (!html.includes('SEARCH_INDEX')) {
      throw new Error('SEARCH_INDEX not found in HTML');
    }
    console.log('✅ SEARCH_INDEX found in HTML');
    
    // Check for search functionality
    if (!html.includes('initSearch') || !html.includes('performSearch')) {
      throw new Error('Search functions not found in HTML');
    }
    console.log('✅ Search functions found in HTML');
    
    console.log('🎉 Basic HTML validation passed!');
    return true;
    
  } catch (error) {
    console.log(`❌ Simple test failed: ${error.message}`);
    return false;
  }
}

// Run tests
async function runTests() {
  const hasPuppeteer = await checkPuppeteer();
  
  if (hasPuppeteer) {
    const success = await testSearch();
    if (!success) {
      console.log('🔄 Puppeteer test failed, running simple test...');
      await simpleFetchTest();
    }
  } else {
    await simpleFetchTest();
  }
}

runTests().catch(console.error);