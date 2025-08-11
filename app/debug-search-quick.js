// Quick debug test to be run in browser console on http://localhost:3000/docs/std/index.html
console.log("🧪 Quick Search Debug Test");

// Check elements exist
const searchInput = document.getElementById('search-input');
const searchSection = document.getElementById('search');
const mainSection = document.getElementById('main-content');

console.log("Elements found:", {
  searchInput: !!searchInput,
  searchSection: !!searchSection, 
  mainSection: !!mainSection
});

// Check SEARCH_INDEX
console.log("SEARCH_INDEX exists:", typeof SEARCH_INDEX !== 'undefined');
if (typeof SEARCH_INDEX !== 'undefined') {
  console.log("SEARCH_INDEX keys:", Object.keys(SEARCH_INDEX));
  console.log("Sample items:", SEARCH_INDEX.std ? SEARCH_INDEX.std.slice(0, 3) : 'no std key');
}

// Test manual search
if (searchInput) {
  console.log("\n⌨️ Testing search input...");
  searchInput.value = 'a';
  
  // Trigger input event
  const event = new Event('input', { bubbles: true });
  searchInput.dispatchEvent(event);
  
  setTimeout(() => {
    console.log("After input event:");
    console.log("- Search section class:", searchSection?.className);
    console.log("- Search section display:", searchSection?.style.display);
    console.log("- Main section class:", mainSection?.className);
    console.log("- Main section display:", mainSection?.style.display);
    console.log("- Search HTML preview:", searchSection?.innerHTML.substring(0, 200));
    
    // Check if results have proper structure
    const hasTable = searchSection?.innerHTML.includes('<table>');
    const hasTypeSpan = searchSection?.innerHTML.includes('<span class="type');
    console.log("- Has table structure:", hasTable);
    console.log("- Has type spans:", hasTypeSpan);
    
  }, 1000);
}