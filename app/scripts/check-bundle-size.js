const fs = require("fs");
const path = require("path");

// Configure size limits (in KB)
const SIZE_LIMITS = {
  TOTAL_JS: 500, // 500KB total JS
  LARGEST_CHUNK: 200, // 200KB for largest chunk
  INITIAL_JS: 300, // 300KB for initial JS
};

function convertToKB(size, unit) {
  if (unit === "MB") return size * 1024;
  if (unit === "KB") return size;
  if (unit === "B") return size / 1024;
  return size; // Already in KB
}

function parseSize(str) {
  if (!str) return 0;
  const match = str.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB)?/);
  if (!match) return 0;
  return convertToKB(parseFloat(match[1]), match[2]);
}

function parseLine(line) {
  // Remove box-drawing characters and other special characters
  const cleanLine = line.replace(/[│├└┌─┐┘]/g, "").trim();
  if (!cleanLine) return null;

  // Extract size from the line
  const parts = cleanLine.split(/\s+/);
  if (parts.length < 2) return null;

  // Get the last part that contains a number (size)
  let size = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].match(/\d/)) {
      size = parseSize(parts[i]);
      break;
    }
  }

  return {
    isChunk: cleanLine.includes(".js"),
    isFirstLoad: cleanLine.includes("First Load JS"),
    size,
  };
}

function parseAnalysis(content) {
  const sizes = {
    totalJS: 0,
    largestChunk: 0,
    initialJS: 0,
  };

  const lines = content.split("\n");
  let inRouteSection = false;

  for (const line of lines) {
    if (line.includes("Route (")) {
      inRouteSection = true;
      continue;
    }

    if (!inRouteSection) continue;

    const parsed = parseLine(line);
    if (!parsed) continue;

    if (parsed.isFirstLoad && parsed.size > sizes.initialJS) {
      sizes.initialJS = parsed.size;
    }

    if (parsed.isChunk) {
      sizes.totalJS += parsed.size;
      if (parsed.size > sizes.largestChunk) {
        sizes.largestChunk = parsed.size;
      }
    }
  }

  return sizes;
}

try {
  const analysisPath = path.join(process.cwd(), "bundle-analysis.txt");
  const analysis = fs.readFileSync(analysisPath, "utf8");
  const sizes = parseAnalysis(analysis);

  console.log("Bundle Size Analysis");
  console.log("-----------------");
  console.log(`Total JS: ${sizes.totalJS.toFixed(2)}KB`);
  console.log(`Largest Chunk: ${sizes.largestChunk.toFixed(2)}KB`);
  console.log(`Initial JS: ${sizes.initialJS.toFixed(2)}KB`);
  console.log();

  let failed = false;

  if (sizes.totalJS > SIZE_LIMITS.TOTAL_JS) {
    console.error(
      `\u274c Total JS (${sizes.totalJS.toFixed(
        2
      )}KB) exceeds limit of ${SIZE_LIMITS.TOTAL_JS}KB`
    );
    failed = true;
  }

  if (sizes.largestChunk > SIZE_LIMITS.LARGEST_CHUNK) {
    console.error(
      `\u274c Largest chunk (${sizes.largestChunk.toFixed(
        2
      )}KB) exceeds limit of ${SIZE_LIMITS.LARGEST_CHUNK}KB`
    );
    failed = true;
  }

  if (sizes.initialJS > SIZE_LIMITS.INITIAL_JS) {
    console.error(
      `\u274c Initial JS (${sizes.initialJS.toFixed(
        2
      )}KB) exceeds limit of ${SIZE_LIMITS.INITIAL_JS}KB`
    );
    failed = true;
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log("\u2705 All bundle size checks passed!");
  }
} catch (error) {
  console.error("Error analyzing bundle size:", error);
  process.exit(1);
}
