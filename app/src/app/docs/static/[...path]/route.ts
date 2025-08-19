import { extractDocFromIPFS } from "../../../../features/docs/lib/ipfs";
import { convertByteCodeContent, getContentType } from "../../../../features/docs/lib/utils";
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
    
    // Fix byte-code issue if needed and determine content type
    content = convertByteCodeContent(content);
    const contentType = getContentType(filePath);
    
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