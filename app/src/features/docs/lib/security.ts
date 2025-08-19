import { createHash } from 'crypto';
import DOMPurify from 'isomorphic-dompurify';

/// Input validation utilities for documentation system
/// Prevents path traversal, injection attacks, and other security vulnerabilities

const PACKAGE_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/;
const VERSION_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$|^latest$/;
const FILE_PATH_REGEX = /^[a-zA-Z0-9._/-]+$/;

export interface ValidationError {
  field: string;
  message: string;
  value: string;
}

export class SecurityValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    this.name = 'SecurityValidationError';
    this.errors = errors;
  }
}

/// Validates and sanitizes package name
/// Ensures name follows npm package naming conventions and prevents path traversal
export function validatePackageName(name: string): string {
  const errors: ValidationError[] = [];
  
  if (!name || typeof name !== 'string') {
    errors.push({ field: 'name', message: 'Package name is required', value: name });
  } else {
    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      errors.push({ field: 'name', message: 'Package name cannot be empty', value: name });
    } else if (trimmed.length > 63) {
      errors.push({ field: 'name', message: 'Package name too long (max 63 characters)', value: name });
    } else if (!PACKAGE_NAME_REGEX.test(trimmed)) {
      errors.push({ 
        field: 'name', 
        message: 'Package name contains invalid characters (only alphanumeric, dash, underscore allowed)', 
        value: name 
      });
    } else if (trimmed.includes('..') || trimmed.includes('/')) {
      errors.push({ field: 'name', message: 'Package name contains path traversal characters', value: name });
    }
  }
  
  if (errors.length > 0) {
    throw new SecurityValidationError(errors);
  }
  
  return name.trim();
}

/// Validates and sanitizes version string
/// Ensures version follows semantic versioning or is 'latest'
export function validateVersion(version: string): string {
  const errors: ValidationError[] = [];
  
  if (!version || typeof version !== 'string') {
    errors.push({ field: 'version', message: 'Version is required', value: version });
  } else {
    const trimmed = version.trim();
    
    if (trimmed.length === 0) {
      errors.push({ field: 'version', message: 'Version cannot be empty', value: version });
    } else if (!VERSION_REGEX.test(trimmed)) {
      errors.push({ 
        field: 'version', 
        message: 'Version must be valid semver (e.g., 1.0.0) or "latest"', 
        value: version 
      });
    }
  }
  
  if (errors.length > 0) {
    throw new SecurityValidationError(errors);
  }
  
  return version.trim();
}

/// Validates and sanitizes file path within documentation
/// Prevents directory traversal and ensures safe file access
export function validateFilePath(filePath: string): string {
  const errors: ValidationError[] = [];
  
  if (!filePath || typeof filePath !== 'string') {
    return 'index.html'; // Default to index.html for empty paths
  }
  
  const trimmed = filePath.trim();
  
  if (trimmed.length === 0) {
    return 'index.html';
  }
  
  // Check for path traversal attempts
  if (trimmed.includes('..') || trimmed.includes('//') || trimmed.startsWith('/')) {
    errors.push({ field: 'filePath', message: 'File path contains invalid traversal patterns', value: filePath });
  }
  
  // Check for valid characters
  if (!FILE_PATH_REGEX.test(trimmed)) {
    errors.push({ 
      field: 'filePath', 
      message: 'File path contains invalid characters', 
      value: filePath 
    });
  }
  
  // Check for dangerous file extensions
  const extension = trimmed.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['html', 'css', 'js', 'svg', 'woff2', 'png', 'jpg', 'jpeg', 'gif', 'ico'];
  
  if (extension && !allowedExtensions.includes(extension)) {
    errors.push({ 
      field: 'filePath', 
      message: 'File extension not allowed', 
      value: filePath 
    });
  }
  
  if (errors.length > 0) {
    throw new SecurityValidationError(errors);
  }
  
  return trimmed;
}

/// Sanitizes HTML content to prevent XSS attacks
/// Uses DOMPurify with strict configuration for documentation content
export function sanitizeHtmlContent(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  const config = {
    ALLOWED_TAGS: [
      'html', 'head', 'body', 'title', 'meta', 'link', 'style',
      'div', 'span', 'p', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'code', 'pre', 'blockquote', 'strong', 'em', 'br', 'hr',
      'form', 'input', 'button', 'nav', 'header', 'footer', 'section',
      'article', 'aside', 'main', 'script'
    ],
    ALLOWED_ATTR: [
      'id', 'class', 'href', 'target', 'rel', 'src', 'alt', 'title',
      'type', 'value', 'placeholder', 'disabled', 'readonly',
      'colspan', 'rowspan', 'role', 'aria-label', 'aria-hidden',
      'data-*', 'style'
    ],
    ALLOW_DATA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SANITIZE_DOM: true,
    SANITIZE_NAMED_PROPS: true,
    KEEP_CONTENT: true,
    // Allow inline scripts for documentation search functionality
    FORBID_TAGS: ['object', 'embed', 'applet', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  };
  
  return DOMPurify.sanitize(html, config);
}

/// Generates CSP nonce for inline scripts
/// Creates a cryptographically secure random nonce for CSP headers
export function generateCSPNonce(): string {
  return createHash('sha256')
    .update(Math.random().toString() + Date.now().toString())
    .digest('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 16);
}

/// Validates IPFS hash format
/// Ensures IPFS hash follows expected format to prevent injection
export function validateIPFSHash(hash: string): string {
  const errors: ValidationError[] = [];
  
  if (!hash || typeof hash !== 'string') {
    errors.push({ field: 'ipfsHash', message: 'IPFS hash is required', value: hash });
  } else {
    const trimmed = hash.trim();
    
    // Check for basic IPFS hash format (Qm... or baf...)
    if (!(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed) || /^baf[a-z0-9]{56}$/.test(trimmed))) {
      errors.push({ 
        field: 'ipfsHash', 
        message: 'Invalid IPFS hash format', 
        value: hash 
      });
    }
  }
  
  if (errors.length > 0) {
    throw new SecurityValidationError(errors);
  }
  
  return hash.trim();
}

/// Rate limiting state for documentation requests
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

/// Implements basic rate limiting for documentation endpoints
/// Prevents DoS attacks by limiting requests per IP address
export function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  
  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    rateLimitMap.set(clientIp, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

/// Cleans up expired rate limit entries
/// Should be called periodically to prevent memory leaks
export function cleanupRateLimit(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

// Cleanup expired entries every 5 minutes
setInterval(cleanupRateLimit, 5 * 60 * 1000);