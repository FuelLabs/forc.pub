import { createHash, randomBytes } from 'crypto';

export class SecurityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

export function validatePackageName(name: string): string {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new SecurityValidationError('Package name is required');
  }
  
  const trimmed = name.trim();
  if (trimmed.includes('..') || trimmed.includes('/')) {
    throw new SecurityValidationError('Invalid package name');
  }
  
  return trimmed;
}

export function validateVersion(version: string): string {
  if (!version || typeof version !== 'string' || !version.trim()) {
    throw new SecurityValidationError('Version is required');
  }
  
  return version.trim();
}

export function validateFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    return 'index.html';
  }
  
  const trimmed = filePath.trim();
  if (!trimmed) {
    return 'index.html';
  }
  
  if (trimmed.includes('..') || trimmed.startsWith('/')) {
    throw new SecurityValidationError('Invalid file path');
  }
  
  return trimmed;
}

export function validateIPFSHash(hash: string): string {
  if (!hash || typeof hash !== 'string' || !hash.trim()) {
    throw new SecurityValidationError('IPFS hash is required');
  }
  
  return hash.trim();
}

export function generateCSPNonce(): string {
  return createHash('sha256')
    .update(Math.random().toString() + Date.now().toString())
    .digest('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 16);
}

// Simple rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

export function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}