// Debug script to run in browser console
console.log("=== DEBUGGING SEARCH FUNCTIONALITY ===");

// Check if elements exist
const searchInput = document.getElementById('search-input');
const searchSection = document.getElementById('search');
const mainSection = document.getElementById('main-content');

console.log("Elements found:");
console.log("- search-input:", !!searchInput);
console.log("- search section:", !!searchSection);  
console.log("- main-content:", !!mainSection);

// Check if SEARCH_INDEX exists
console.log("- SEARCH_INDEX:", typeof SEARCH_INDEX !== 'undefined');
if (typeof SEARCH_INDEX !== 'undefined') {
    console.log("- SEARCH_INDEX keys:", Object.keys(SEARCH_INDEX));
    console.log("- First few items:", SEARCH_INDEX.std ? SEARCH_INDEX.std.slice(0, 3) : 'no std key');
}

// Test manual search
if (typeof SEARCH_INDEX !== 'undefined') {
    console.log("\n=== TESTING MANUAL SEARCH FOR 'a' ===");
    const query = 'a';
    const results = [];
    
    for (const crate in SEARCH_INDEX) {
        const items = SEARCH_INDEX[crate] || [];
        for (const item of items) {
            if (item.name.toLowerCase().includes(query)) {
                results.push(item.name);
            }
        }
    }
    
    console.log("Found", results.length, "results for 'a'");
    console.log("First 10:", results.slice(0, 10));
}

// Test input event
if (searchInput) {
    console.log("\n=== TESTING INPUT EVENT ===");
    searchInput.value = 'a';
    const event = new Event('input', { bubbles: true });
    searchInput.dispatchEvent(event);
    
    setTimeout(() => {
        console.log("After input event:");
        console.log("- searchSection innerHTML:", searchSection ? searchSection.innerHTML.substring(0, 100) : 'null');
        console.log("- searchSection display:", searchSection ? searchSection.style.display : 'null');
        console.log("- mainSection display:", mainSection ? mainSection.style.display : 'null');
    }, 500);
}