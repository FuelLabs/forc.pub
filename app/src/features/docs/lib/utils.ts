/// Utility functions for documentation system

/// Determines MIME type based on file extension
export function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'html':
      return 'text/html; charset=utf-8';
    case 'css':
      return 'text/css';
    case 'js':
      return 'application/javascript';
    case 'svg':
      return 'image/svg+xml';
    case 'woff':
    case 'woff2':
      return 'font/woff2';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

/// Converts byte-code string to actual content if needed
/// This handles the comma-separated byte code format that sometimes appears in IPFS content
export function convertByteCodeContent(content: string): string {
  if (content.includes(',') && /^\d+,\d+/.test(content.substring(0, 10))) {
    const byteCodes = content.split(',').map(num => parseInt(num.trim()));
    return String.fromCharCode(...byteCodes);
  }
  return content;
}

/// Checks if a file extension is allowed for documentation
export function isAllowedFileExtension(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['html', 'css', 'js', 'svg', 'woff2', 'png', 'jpg', 'jpeg', 'gif', 'ico'];
  return !ext || allowedExtensions.includes(ext);
}

/// Extracts filename from a file path
export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/// Checks if a path represents an HTML file
export function isHtmlFile(filePath: string): boolean {
  return filePath.endsWith('.html') || filePath.endsWith('.htm');
}

/// Creates a standardized cache key
export function createCacheKey(packageName: string, version: string, filePath?: string): string {
  return filePath ? `${packageName}@${version}:${filePath}` : `${packageName}@${version}`;
}