'use client';

import { useEffect, useState } from 'react';
import { extractDocFromIPFS } from "../../../features/docs/lib/ipfs";

export default function StyledTestDocsPage({
  searchParams,
}: {
  searchParams: { ipfs?: string; file?: string };
}) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const ipfsHash = searchParams.ipfs;
  const filePath = searchParams.file || 'std/index.html';

  useEffect(() => {
    if (!ipfsHash) return;

    async function loadContent() {
      try {
        setLoading(true);
        console.log(`Loading IPFS content: ${ipfsHash} -> ${filePath}`);
        
        const docContent = await extractDocFromIPFS(ipfsHash, filePath);
        console.log(`Successfully loaded ${docContent.length} characters`);
        
        // Handle byte code conversion if needed
        let actualContent = docContent;
        const firstChar = docContent.substring(0, 10);
        
        if (firstChar.includes(',') && /^\d+,\d+/.test(firstChar)) {
          console.log('Detected comma-separated byte codes, converting...');
          const byteCodes = docContent.split(',').map(num => parseInt(num.trim()));
          actualContent = String.fromCharCode(...byteCodes);
          console.log('Conversion successful, new length:', actualContent.length);
        }
        
        // Fix static file paths
        let processedContent = actualContent;
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

        // Extract CSS links and inject them into document head
        const cssLinks = processedContent.match(/<link[^>]*rel="stylesheet"[^>]*>/gi) || [];
        console.log('Found CSS links:', cssLinks.length);
        
        // Inject CSS links into document head
        cssLinks.forEach((link, index) => {
          const linkElement = document.createElement('link');
          const hrefMatch = link.match(/href="([^"]*)"/);
          const typeMatch = link.match(/type="([^"]*)"/);
          
          if (hrefMatch) {
            linkElement.rel = 'stylesheet';
            linkElement.type = typeMatch ? typeMatch[1] : 'text/css';
            linkElement.href = hrefMatch[1];
            linkElement.id = `sway-doc-css-${index}`;
            document.head.appendChild(linkElement);
            console.log(`Injected CSS: ${linkElement.href}`);
          }
        });

        // Extract body content
        const bodyMatch = processedContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let bodyContent = bodyMatch ? bodyMatch[1] : processedContent;
        
        // Basic sanitization
        bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        bodyContent = bodyContent.replace(/<script[^>]*\/>/gi, '');
        bodyContent = bodyContent.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
        bodyContent = bodyContent.replace(/javascript:/gi, '');
        
        setContent(bodyContent);
        setLoading(false);
      } catch (err) {
        console.error('Error loading content:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    loadContent();

    // Cleanup function to remove injected CSS
    return () => {
      const injectedStyles = document.querySelectorAll('[id^="sway-doc-css-"]');
      injectedStyles.forEach(style => style.remove());
    };
  }, [ipfsHash, filePath]);

  if (!ipfsHash) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1>Styled Test Documentation Page</h1>
        <p>Add an IPFS hash as a query parameter:</p>
        <code>
          http://localhost:3000/docs/styled-test?ipfs=QmexhLHpyb6TMArffS6prZesMnYu53FdL7ThEA5F3ab3va
        </code>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1>Loading...</h1>
        <p>Loading documentation from IPFS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1 style={{ color: '#d32f2f' }}>Error Loading Documentation</h1>
        <p><strong>IPFS Hash:</strong> {ipfsHash}</p>
        <p><strong>File:</strong> {filePath}</p>
        <p><strong>Error:</strong> {error}</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ 
        background: '#f5f5f5', 
        padding: '10px', 
        marginBottom: '20px',
        borderRadius: '4px',
        fontSize: '14px',
        fontFamily: 'monospace',
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        maxWidth: '300px'
      }}>
        <strong>Styled Test:</strong> {ipfsHash?.substring(0, 10)}...
      </div>
      <div 
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </>
  );
}