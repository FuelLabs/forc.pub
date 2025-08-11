import { redirect, notFound } from "next/navigation";
import { getPackageDetail, getLatestVersion } from "../../../../features/docs/lib/api";
import { extractDocFromIPFS } from "../../../../features/docs/lib/ipfs";

interface DocsPageProps {
  params: {
    name: string;
    path?: string[];
  };
}

export async function generateMetadata({ params }: DocsPageProps) {
  const { name, path = [] } = params;
  const version = path[0];
  
  // Try to get package details for better metadata
  let packageDesc = null;
  try {
    if (version) {
      const packageData = await getPackageDetail(name, version);
      packageDesc = packageData.description;
    }
  } catch {
    // Fallback to generic description if package details unavailable
  }
  
  const description = packageDesc 
    ? `Documentation for ${name}: ${packageDesc}` 
    : `Auto-generated documentation for ${name} Sway package`;
    
  return {
    title: `${name}${version ? ` v${version}` : ""} - Sway Documentation`,
    description: description,
    keywords: ['sway', 'fuel', 'blockchain', 'documentation', name],
    authors: [{ name: 'forc.pub' }],
    openGraph: {
      title: `${name}${version ? ` v${version}` : ""} Documentation`,
      description: description,
      type: 'website',
      url: `https://docs.forc.pub/${name}${version ? `/${version}` : ''}`,
      siteName: 'forc.pub',
    },
    twitter: {
      card: 'summary',
      title: `${name}${version ? ` v${version}` : ""} Documentation`,
      description: description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  };
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { name, path = [] } = params;
  
  // If no path specified, redirect to latest version
  if (path.length === 0) {
    try {
      const latestVersion = await getLatestVersion(name);
      redirect(`/docs/${name}/${latestVersion}`);
    } catch {
      console.error(`Failed to get latest version for ${name}`);
      notFound();
    }
  }
  
  const [version, ...docPath] = path;
  const filePath = docPath.length > 0 ? docPath.join('/') : 'index.html';
  
  try {
    // Get package data to access docs_ipfs_hash
    const packageData = await getPackageDetail(name, version);
    
    if (!packageData.docsIpfsUrl) {
      console.error(`No documentation URL found for ${name}@${version}`);
      notFound();
    }
    
    // Extract the IPFS hash from the docs URL
    const docsIpfsHash = extractHashFromDocsUrl(packageData.docsIpfsUrl);
    if (!docsIpfsHash) {
      console.error(`Could not extract IPFS hash from docs URL: ${packageData.docsIpfsUrl}`);
      notFound();
    }
    
    // Extract and serve the documentation directly
    const docContent = await extractDocFromIPFS(docsIpfsHash, filePath);
    
    // Post-process the HTML content to improve styling and add navigation
    const processedContent = processDocumentationHTML(docContent, name, version);
    
    // Sanitize the HTML content to prevent XSS attacks
    // Note: In a production app, you'd want more sophisticated HTML sanitization
    // For now, we'll do basic content filtering to remove potentially dangerous elements
    let sanitizedContent = processedContent;
    
    // Remove script tags and event handlers
    sanitizedContent = sanitizedContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    sanitizedContent = sanitizedContent.replace(/<script[^>]*\/>/gi, '');
    sanitizedContent = sanitizedContent.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitizedContent = sanitizedContent.replace(/javascript:/gi, '');
    
    // Remove other potentially dangerous elements
    sanitizedContent = sanitizedContent.replace(/<(object|embed|iframe|frame|frameset|noframes|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');
    sanitizedContent = sanitizedContent.replace(/<(object|embed|iframe|frame|frameset|noframes|noscript)[^>]*\/>/gi, '');
    
    // Return the documentation content as HTML
    return (
      <div 
        className="docs-content"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        style={{
          width: '100%',
          minHeight: '100vh',
          overflow: 'auto',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: '1.6',
          color: '#333',
          backgroundColor: '#fff',
          maxWidth: '1200px',
          margin: '0 auto'
        }}
      />
    );
  } catch (error) {
    console.error(`Error serving documentation for ${name}@${version}:`, error);
    
    // Provide more specific error handling based on error type
    if (error instanceof Error) {
      if (error.message.includes('not available from any source')) {
        // Return a more helpful error page for missing docs instead of 404
        return (
          <div style={{
            width: '100%',
            minHeight: '100vh',
            padding: '40px 20px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: '1.6',
            color: '#333',
            backgroundColor: '#fff',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h1 style={{ color: '#f57c00', marginBottom: '20px' }}>
              Documentation Temporarily Unavailable
            </h1>
            <p style={{ fontSize: '18px', marginBottom: '20px' }}>
              Documentation for <strong>{name} v{version}</strong> is temporarily unavailable.
            </p>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              This could be due to:
            </p>
            <ul style={{ 
              textAlign: 'left', 
              display: 'inline-block',
              color: '#666',
              marginBottom: '30px'
            }}>
              <li>Documentation is still being processed after publishing</li>
              <li>Temporary issues accessing IPFS storage</li>
              <li>Network connectivity issues</li>
            </ul>
            <p style={{ marginBottom: '30px' }}>
              Please try again in a few minutes, or browse other documentation.
            </p>
            <a 
              href={`/package/${name}/${version}`}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#1976d2',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                marginRight: '10px'
              }}
            >
              View Package Details
            </a>
            <a 
              href="/docs"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                border: '1px solid #1976d2',
                color: '#1976d2',
                textDecoration: 'none',
                borderRadius: '4px'
              }}
            >
              Browse Documentation
            </a>
          </div>
        );
      }
      
      if (error.message.includes('Package not found')) {
        // Handle package not found case
        return (
          <div style={{
            width: '100%',
            minHeight: '100vh',
            padding: '40px 20px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: '1.6',
            color: '#333',
            backgroundColor: '#fff',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h1 style={{ color: '#d32f2f', marginBottom: '20px' }}>
              Package Not Found
            </h1>
            <p style={{ fontSize: '18px', marginBottom: '20px' }}>
              The package <strong>{name} v{version}</strong> does not exist.
            </p>
            <p style={{ color: '#666', marginBottom: '30px' }}>
              Please check the package name and version, or search for available packages.
            </p>
            <a 
              href="/docs"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#1976d2',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px'
              }}
            >
              Browse All Documentation
            </a>
          </div>
        );
      }
    }
    
    // Fallback to 404 for unknown errors
    notFound();
  }
}

// Helper function to extract IPFS hash from docs URL
function extractHashFromDocsUrl(docsUrl: string): string | null {
  const match = docsUrl.match(/\/ipfs\/([^/?]+)/);
  return match ? match[1] : null;
}

// Helper function to process and enhance the documentation HTML
function processDocumentationHTML(html: string, packageName: string, version: string): string {
  // Add a header with package information if it's not already present
  if (!html.includes('<title>') || !html.includes('<h1>')) {
    const headerHTML = `
      <div style="border-bottom: 1px solid #e0e0e0; margin-bottom: 20px; padding-bottom: 15px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <h1 style="margin: 0; color: #1976d2;">${packageName} v${version}</h1>
          <a href="/docs" style="color: #1976d2; text-decoration: none; font-size: 14px;">← Back to Docs</a>
        </div>
        <p style="margin: 0; color: #666; font-size: 14px;">Auto-generated documentation</p>
      </div>
    `;
    
    // Insert the header at the beginning of the body content
    if (html.includes('<body>')) {
      html = html.replace('<body>', `<body>${headerHTML}`);
    } else {
      html = headerHTML + html;
    }
  }
  
  // Fix relative links to work within the docs context
  html = html.replace(/href="([^"]*\.html)"/g, (match, href) => {
    if (href.startsWith('http') || href.startsWith('/')) {
      return match; // Keep absolute URLs unchanged
    }
    return `href="/docs/${packageName}/${version}/${href}"`;
  });
  
  // Add some CSS for better styling if not present
  if (!html.includes('<style>') && !html.includes('stylesheet')) {
    const additionalCSS = `
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
        code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', monospace; }
        pre code { background: none; padding: 0; }
        h1, h2, h3, h4, h5, h6 { color: #333; margin-top: 30px; margin-bottom: 15px; }
        a { color: #1976d2; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .search-container { margin-bottom: 20px; }
      </style>
    `;
    
    if (html.includes('<head>')) {
      html = html.replace('</head>', additionalCSS + '</head>');
    } else {
      html = additionalCSS + html;
    }
  }
  
  return html;
}