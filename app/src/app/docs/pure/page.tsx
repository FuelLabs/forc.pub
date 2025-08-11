import { extractDocFromIPFS } from "../../../features/docs/lib/ipfs";

export default async function PureDocsPage({
  searchParams,
}: {
  searchParams: { ipfs?: string; file?: string };
}) {
  const ipfsHash = searchParams.ipfs;
  const filePath = searchParams.file || 'std/index.html';

  if (!ipfsHash) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1>Pure Documentation Page</h1>
        <p>Add an IPFS hash as a query parameter:</p>
        <code>
          http://localhost:3000/docs/pure?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va
        </code>
      </div>
    );
  }

  try {
    const docContent = await extractDocFromIPFS(ipfsHash, filePath);
    
    // Handle byte code conversion if needed
    let actualContent = docContent;
    const firstChar = docContent.substring(0, 10);
    
    if (firstChar.includes(',') && /^\d+,\d+/.test(firstChar)) {
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

    // Load all CSS content inline to avoid any external loading issues
    const cssLinks = processedContent.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]*)"[^>]*>/gi) || [];
    const cssUrls = cssLinks.map(link => {
      const match = link.match(/href="([^"]*)"/);
      return match ? match[1] : null;
    }).filter(Boolean);

    let allCSS = '';
    for (const cssUrl of cssUrls) {
      try {
        const filename = cssUrl.split('/').pop()?.split('?')[0];
        if (filename) {
          const cssContent = await extractDocFromIPFS(ipfsHash, `static.files/${filename}`);
          
          let actualCSS = cssContent;
          if (cssContent.includes(',') && /^\d+,\d+/.test(cssContent.substring(0, 10))) {
            const byteCodes = cssContent.split(',').map(num => parseInt(num.trim()));
            actualCSS = String.fromCharCode(...byteCodes);
          }
          
          allCSS += actualCSS + '\n';
        }
      } catch (error) {
        console.error(`Failed to load CSS ${cssUrl}:`, error);
      }
    }

    // Extract and clean up the full HTML document
    let cleanedHTML = processedContent;
    
    // Remove scripts for security
    cleanedHTML = cleanedHTML.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanedHTML = cleanedHTML.replace(/<script[^>]*\/>/gi, '');
    cleanedHTML = cleanedHTML.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Replace the existing CSS links with inline styles
    cleanedHTML = cleanedHTML.replace(/<link[^>]*rel="stylesheet"[^>]*>/gi, '');
    
    // Inject the CSS into the head
    cleanedHTML = cleanedHTML.replace(
      '</head>',
      `<style>${allCSS}</style></head>`
    );

    // Return raw HTML response
    return new Response(cleanedHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Error loading pure docs:', error);
    return new Response(
      `<html><body><h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p></body></html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 500,
      }
    );
  }
}