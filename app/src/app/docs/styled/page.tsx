import { extractDocFromIPFS } from "../../../features/docs/lib/ipfs";

export default async function StyledDocsPage({
  searchParams,
}: {
  searchParams: { ipfs?: string; file?: string };
}) {
  const ipfsHash = searchParams.ipfs;
  const filePath = searchParams.file || 'std/index.html';

  if (!ipfsHash) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1>Styled Documentation Page</h1>
        <p>Add an IPFS hash as a query parameter:</p>
        <code>
          http://localhost:3000/docs/styled?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va
        </code>
      </div>
    );
  }

  try {
    console.log(`Loading IPFS content: ${ipfsHash} -> ${filePath}`);
    
    const docContent = await extractDocFromIPFS(ipfsHash, filePath);
    
    // Handle byte code conversion if needed
    let actualContent = docContent;
    const firstChar = docContent.substring(0, 10);
    
    if (firstChar.includes(',') && /^\d+,\d+/.test(firstChar)) {
      console.log('Converting byte codes...');
      const byteCodes = docContent.split(',').map(num => parseInt(num.trim()));
      actualContent = String.fromCharCode(...byteCodes);
    }
    
    // Fix static file paths
    let processedContent = actualContent;
    processedContent = processedContent.replace(
      /href="(\.\.\/)+static\.files\/([^"]+)"/g, 
      `href="/docs/static/$2?ipfs=${ipfsHash}"`
    );
    
    processedContent = processedContent.replace(
      /src="(\.\.\/)+static\.files\/([^"]+)"/g,
      `src="/docs/static/$2?ipfs=${ipfsHash}"`
    );

    // Extract CSS URLs from link tags
    const cssLinks = processedContent.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]*)"[^>]*>/gi) || [];
    const cssUrls = cssLinks.map(link => {
      const match = link.match(/href="([^"]*)"/);
      return match ? match[1] : null;
    }).filter(Boolean);

    // Load all CSS content
    let combinedCSS = '';
    for (const cssUrl of cssUrls) {
      if (!cssUrl) continue;
      try {
        // Extract filename from URL and load from IPFS
        const filename = cssUrl.split('/').pop()?.split('?')[0];
        if (filename) {
          console.log(`Loading CSS: ${filename}`);
          const cssContent = await extractDocFromIPFS(ipfsHash, `static.files/${filename}`);
          
          // Handle byte code conversion for CSS too
          let actualCSS = cssContent;
          if (cssContent.includes(',') && /^\d+,\d+/.test(cssContent.substring(0, 10))) {
            const byteCodes = cssContent.split(',').map(num => parseInt(num.trim()));
            actualCSS = String.fromCharCode(...byteCodes);
          }
          
          // Add !important to key CSS rules to override MUI styles
          let prioritizedCSS = actualCSS;
          
          // Make key sway documentation styles more specific
          if (filename === 'swaydoc.css' || filename === 'ayu.css') {
            prioritizedCSS = prioritizedCSS.replace(
              /body\s*{([^}]+)}/g,
              '.swaydoc body, body.swaydoc { $1 !important }'
            );
            prioritizedCSS = prioritizedCSS.replace(
              /html\s*{([^}]+)}/g,
              'html.swaydoc, .swaydoc html { $1 !important }'
            );
            prioritizedCSS = prioritizedCSS.replace(
              /\.(sidebar|content|main-heading|fqn|item-table|search-input)\s*{([^}]+)}/g,
              '.$1 { $2 !important }'
            );
          }
          
          combinedCSS += `\n/* ${filename} */\n${prioritizedCSS}\n`;
        }
      } catch (error) {
        console.error(`Failed to load CSS ${cssUrl}:`, error);
      }
    }

    // Extract body content only
    const bodyMatch = processedContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let bodyContent = bodyMatch ? bodyMatch[1] : processedContent;
    
    // If no body found, try to get content after head
    if (!bodyMatch) {
      const headEndMatch = processedContent.match(/<\/head>\s*([\s\S]*)/i);
      if (headEndMatch) {
        bodyContent = headEndMatch[1];
        // Remove html and body tags if they exist
        bodyContent = bodyContent.replace(/<\/?html[^>]*>/gi, '');
        bodyContent = bodyContent.replace(/<\/?body[^>]*>/gi, '');
      }
    }
    
    // Basic sanitization
    bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    bodyContent = bodyContent.replace(/<script[^>]*\/>/gi, '');
    bodyContent = bodyContent.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
    bodyContent = bodyContent.replace(/javascript:/gi, '');

    return (
      <>
        {/* Inject CSS as inline styles */}
        <style dangerouslySetInnerHTML={{ __html: combinedCSS }} />
        
        {/* Small indicator */}
        <div style={{ 
          position: 'fixed', 
          top: '10px', 
          right: '10px', 
          background: '#e8f5e8', 
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
          border: '1px solid #4caf50'
        }}>
          Styled: {cssUrls.length} CSS files loaded
        </div>
        
        {/* Render the body content */}
        <div 
          className="swaydoc"
          dangerouslySetInnerHTML={{ __html: bodyContent }}
        />
      </>
    );

  } catch (error) {
    console.error('Error loading styled docs:', error);
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1 style={{ color: '#d32f2f' }}>Error Loading Documentation</h1>
        <p><strong>Error:</strong> {error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}