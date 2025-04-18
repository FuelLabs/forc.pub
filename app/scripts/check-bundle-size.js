const fs = require("fs");
const path = require("path");

// Configure size limits (in KB)
const SIZE_LIMITS = {
  TOTAL_JS: 500, // 500KB total JS
  LARGEST_CHUNK: 200, // 200KB for largest chunk
  INITIAL_JS: 300, // 300KB for initial JS
};

function parseAnalysis(content) {
  const sizes = {
    totalJS: 0,
    largestChunk: 0,
    initialJS: 0,
  };

  const lines = content.split("\n");
  let parsingJS = false;

  for (const line of lines) {
    if (line.includes("Page Size Analysis")) {
      parsingJS = true;
      continue;
    }

    if (!parsingJS) continue;

    if (line.includes(".js")) {
      const match = line.match(/(\d+(?:\.\d+)?)\s*(?:B|KB|MB)/);
      if (match) {
        const size = parseFloat(match[1]);
        const unit = line.match(/[KMB]B/)[0];

        // Convert to KB
        const sizeInKB =
          unit === "MB" ? size * 1024 : unit === "B" ? size / 1024 : size;

        sizes.totalJS += sizeInKB;
        sizes.largestChunk = Math.max(sizes.largestChunk, sizeInKB);

        if (line.includes("First Load JS")) {
          sizes.initialJS = sizeInKB;
        }
      }
    }
  }

  return sizes;
}

try {
  const analysisPath = path.join(process.cwd(), "bundle-analysis.txt");
  const analysis = fs.readFileSync(analysisPath, "utf8");
  const sizes = parseAnalysis(analysis);

  console.log("\nBundle Size Analysis:");
  console.log("-------------------");
  console.log(
    `Total JS: ${sizes.totalJS.toFixed(2)}KB (limit: ${
      SIZE_LIMITS.TOTAL_JS
    }KB)`,
  );
  console.log(
    `Largest Chunk: ${sizes.largestChunk.toFixed(2)}KB (limit: ${
      SIZE_LIMITS.LARGEST_CHUNK
    }KB)`,
  );
  console.log(
    `Initial JS: ${sizes.initialJS.toFixed(2)}KB (limit: ${
      SIZE_LIMITS.INITIAL_JS
    }KB)`,
  );

  // Check against limits
  if (sizes.totalJS > SIZE_LIMITS.TOTAL_JS) {
    throw new Error(
      `Total JS size (${sizes.totalJS.toFixed(2)}KB) exceeds limit (${
        SIZE_LIMITS.TOTAL_JS
      }KB)`,
    );
  }
  if (sizes.largestChunk > SIZE_LIMITS.LARGEST_CHUNK) {
    throw new Error(
      `Largest chunk (${sizes.largestChunk.toFixed(2)}KB) exceeds limit (${
        SIZE_LIMITS.LARGEST_CHUNK
      }KB)`,
    );
  }
  if (sizes.initialJS > SIZE_LIMITS.INITIAL_JS) {
    throw new Error(
      `Initial JS size (${sizes.initialJS.toFixed(2)}KB) exceeds limit (${
        SIZE_LIMITS.INITIAL_JS
      }KB)`,
    );
  }

  console.log("\n✅ All bundle size checks passed!");
  process.exit(0);
} catch (error) {
  console.error("\n❌ Bundle size check failed:", error.message);
  process.exit(1);
}
