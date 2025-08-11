import { extractDocFromIPFS } from "../../../features/docs/lib/ipfs";

export default async function TestDocsPage({
  searchParams,
}: {
  searchParams: { ipfs?: string; file?: string };
}) {
  const ipfsHash = searchParams.ipfs;
  const filePath = searchParams.file || 'std/index.html';

  if (!ipfsHash) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1>Test Documentation Page</h1>
        <p>Add an IPFS hash as a query parameter:</p>
        <code>
          http://localhost:3000/docs/test?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va
        </code>
        <p>Optional file parameter:</p>
        <code>
          http://localhost:3000/docs/test?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va&file=std/option/enum.Option.html
        </code>
      </div>
    );
  }

  try {
    console.log(`Testing IPFS extraction: ${ipfsHash} -> ${filePath}`);
    console.log(`Full test URL: http://localhost:3000/docs/test?ipfs=${ipfsHash}&file=${filePath}`);
    
    const docContent = await extractDocFromIPFS(ipfsHash, filePath);
    console.log(`Successfully extracted ${docContent.length} characters from ${filePath}`);
    
    // DEBUG: Check what type of data we got
    console.log('docContent type:', typeof docContent);
    console.log('docContent constructor:', docContent.constructor.name);
    
    // Check if this is actually byte codes disguised as a string
    let actualContent = docContent;
    const firstChar = docContent.substring(0, 10);
    console.log('First 10 chars:', firstChar);
    
    if (firstChar.includes(',') && /^\d+,\d+/.test(firstChar)) {
      console.log('Detected comma-separated byte codes, converting...');
      // Split by comma and convert to actual characters
      const byteCodes = docContent.split(',').map(num => parseInt(num.trim()));
      actualContent = String.fromCharCode(...byteCodes);
      console.log('Conversion successful, new length:', actualContent.length);
    } else if (typeof docContent !== 'string') {
      console.log('Converting non-string to string...');
      if (Array.isArray(docContent)) {
        actualContent = String.fromCharCode(...docContent);
      } else if (docContent instanceof Uint8Array) {
        actualContent = new TextDecoder().decode(docContent);
      } else {
        actualContent = docContent.toString();
      }
    }
    
    console.log('=== EXTRACTED HTML (first 500 chars) ===');
    console.log(actualContent.substring(0, 500));
    console.log('=== END SAMPLE ===');

    // Fix static file paths to point to our static route with IPFS hash
    let processedContent = actualContent;
    
    // Check what static paths exist
    const hasOneDot = processedContent.includes('../static.files/');
    const hasTwoDots = processedContent.includes('../../static.files/');
    const hasThreeDots = processedContent.includes('../../../static.files/');
    const hasStaticFiles = processedContent.includes('static.files/');
    console.log(`Static paths found: ../ = ${hasOneDot}, ../../ = ${hasTwoDots}, ../../../ = ${hasThreeDots}, any static.files = ${hasStaticFiles}`);
    
    // Debug: show a sample of the HTML around static files
    const staticMatch = processedContent.match(/href="[^"]*static\.files[^"]*"/);
    if (staticMatch) {
      console.log('Found static path example:', staticMatch[0]);
    }
    
    // Fix ALL possible relative paths for CSS and JS files
    processedContent = processedContent.replace(
      /href="(\.\.\/)+static\.files\/([^"]+)"/g, 
      (match, dotPath, fileName) => {
        console.log(`Replacing CSS: ${match} -> /docs/static/${fileName}?ipfs=${ipfsHash}`);
        return `href="/docs/static/${fileName}?ipfs=${ipfsHash}"`;
      }
    );
    
    processedContent = processedContent.replace(
      /src="(\.\.\/)+static\.files\/([^"]+)"/g,
      (match, dotPath, fileName) => {
        console.log(`Replacing JS/img: ${match} -> /docs/static/${fileName}?ipfs=${ipfsHash}`);
        return `src="/docs/static/${fileName}?ipfs=${ipfsHash}"`;
      }
    );
    
    console.log('After processing:', processedContent.includes('/docs/static/') ? 'contains fixed paths' : 'no fixed paths found');
    
    // DEBUG: Let's see the actual HTML head section
    const headMatch = processedContent.match(/<head>.*?<\/head>/s);
    if (headMatch) {
      console.log('=== HEAD SECTION ===');
      console.log(headMatch[0]);
      console.log('===================');
    }
    
    // Basic HTML sanitization (BUT KEEP CSS LINKS!)
    let sanitizedContent = processedContent;
    
    // BEFORE sanitization - check for CSS links
    const cssBeforeSanitization = sanitizedContent.match(/link.*?stylesheet.*?href="[^"]*"/gi);
    console.log('CSS links before sanitization:', cssBeforeSanitization?.length || 0);
    if (cssBeforeSanitization) {
      cssBeforeSanitization.forEach((link, i) => console.log(`CSS ${i}:`, link));
    }
    
    sanitizedContent = sanitizedContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    sanitizedContent = sanitizedContent.replace(/<script[^>]*\/>/gi, '');
    sanitizedContent = sanitizedContent.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitizedContent = sanitizedContent.replace(/javascript:/gi, '');
    
    // AFTER sanitization - check for CSS links  
    const cssAfterSanitization = sanitizedContent.match(/link.*?stylesheet.*?href="[^"]*"/gi);
    console.log('CSS links after sanitization:', cssAfterSanitization?.length || 0);

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ 
          background: '#f5f5f5', 
          padding: '10px', 
          marginBottom: '20px',
          borderRadius: '4px',
          fontSize: '14px',
          fontFamily: 'monospace'
        }}>
          <strong>Test Mode:</strong> IPFS Hash = {ipfsHash}, File = {filePath}
        </div>
        <div 
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          style={{
            width: '100%',
            minHeight: '100vh',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: '1.6',
            color: '#333',
            backgroundColor: '#fff'
          }}
        />
      </div>
    );
  } catch (error) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1 style={{ color: '#d32f2f' }}>Error Loading Documentation</h1>
        <p><strong>IPFS Hash:</strong> {ipfsHash}</p>
        <p><strong>File:</strong> {filePath}</p>
        <p><strong>Error:</strong> {error instanceof Error ? error.message : 'Unknown error'}</p>
        
        <h3>Debug Info:</h3>
        <ul>
          <li>Make sure the IPFS hash is correct</li>
          <li>Check that the file exists in the tarball</li>
          <li>Verify IPFS gateways are accessible</li>
        </ul>
      </div>
    );
  }
}