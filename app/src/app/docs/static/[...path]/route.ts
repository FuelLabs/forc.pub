import { extractDocFromIPFS } from "../../../../features/docs/lib/ipfs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const searchParams = request.nextUrl.searchParams;
  const ipfsHash = searchParams.get('ipfs');
  
  if (!ipfsHash) {
    return NextResponse.json({ error: 'IPFS hash required' }, { status: 400 });
  }
  
  const filePath = params.path.join('/');
  // The tarball contains files at paths like "static.files/normalize.css"
  // When request is /docs/static/normalize.css, we need to look for "static.files/normalize.css"
  const tarballPath = `static.files/${filePath}`;
  
  try {
    let content = await extractDocFromIPFS(ipfsHash, tarballPath);
    
    // Fix byte-code issue if needed
    if (typeof content === 'string' && content.includes(',') && /^\d+,\d+/.test(content.substring(0, 10))) {
      const byteCodes = content.split(',').map(num => parseInt(num.trim()));
      content = String.fromCharCode(...byteCodes);
    }
    
    // Determine content type based on file extension
    const ext = filePath.split('.').pop()?.toLowerCase();
    let contentType = 'text/plain';
    
    switch (ext) {
      case 'css':
        contentType = 'text/css';
        break;
      case 'js':
        contentType = 'application/javascript';
        break;
      case 'svg':
        contentType = 'image/svg+xml';
        break;
      case 'woff':
      case 'woff2':
        contentType = 'font/woff2';
        break;
    }
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error(`Error serving static file ${filePath}:`, error);
    return NextResponse.json(
      { error: `File not found: ${filePath}` }, 
      { status: 404 }
    );
  }
}