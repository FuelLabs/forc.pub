/// Comprehensive error handling and logging for documentation system
/// Provides structured error types, logging utilities, and error recovery strategies

import { SecurityValidationError } from './security';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  IPFS = 'ipfs',
  CACHE = 'cache',
  SECURITY = 'security',
  PARSING = 'parsing',
  RATE_LIMIT = 'rate_limit'
}

export interface ErrorContext {
  packageName?: string;
  version?: string;
  filePath?: string;
  ipfsHash?: string;
  clientIp?: string;
  userAgent?: string;
  timestamp: number;
  requestId?: string;
}

export class DocsError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly code: string;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext,
    code: string,
    recoverable: boolean = true
  ) {
    super(message);
    this.name = 'DocsError';
    this.category = category;
    this.severity = severity;
    this.context = context;
    this.code = code;
    this.recoverable = recoverable;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      context: this.context,
      code: this.code,
      recoverable: this.recoverable,
      stack: this.stack
    };
  }
}

export class NetworkError extends DocsError {
  public readonly statusCode?: number;
  public readonly url?: string;

  constructor(
    message: string,
    context: ErrorContext,
    statusCode?: number,
    url?: string
  ) {
    super(
      message,
      ErrorCategory.NETWORK,
      statusCode && statusCode >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      context,
      `NET_${statusCode || 'UNKNOWN'}`,
      true
    );
    this.statusCode = statusCode;
    this.url = url;
  }
}

export class IPFSError extends DocsError {
  public readonly hash?: string;
  public readonly gateway?: string;

  constructor(
    message: string,
    context: ErrorContext,
    hash?: string,
    gateway?: string
  ) {
    super(
      message,
      ErrorCategory.IPFS,
      ErrorSeverity.HIGH,
      context,
      'IPFS_FETCH_FAILED',
      true
    );
    this.hash = hash;
    this.gateway = gateway;
  }
}

export class CacheError extends DocsError {
  constructor(message: string, context: ErrorContext) {
    super(
      message,
      ErrorCategory.CACHE,
      ErrorSeverity.LOW,
      context,
      'CACHE_ERROR',
      true
    );
  }
}

export class RateLimitError extends DocsError {
  public readonly limit: number;
  public readonly window: number;

  constructor(
    message: string,
    context: ErrorContext,
    limit: number,
    window: number
  ) {
    super(
      message,
      ErrorCategory.RATE_LIMIT,
      ErrorSeverity.MEDIUM,
      context,
      'RATE_LIMIT_EXCEEDED',
      false // Not recoverable immediately
    );
    this.limit = limit;
    this.window = window;
  }
}

/// Logger interface for structured logging
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
  category?: string;
}

class DocsLogger {
  private entries: LogEntry[] = [];
  private maxEntries = 1000;

  private log(level: LogEntry['level'], message: string, context?: Record<string, unknown>, category?: string) {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: Date.now(),
      category
    };

    this.entries.push(entry);

    // Keep only the most recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Output to console with structured format
    const logMessage = `[${new Date().toISOString()}] ${level.toUpperCase()} ${category ? `[${category}] ` : ''}${message}`;
    
    if (context) {
      console[level](logMessage, context);
    } else {
      console[level](logMessage);
    }
  }

  debug(message: string, context?: Record<string, unknown>, category?: string) {
    this.log('debug', message, context, category);
  }

  info(message: string, context?: Record<string, unknown>, category?: string) {
    this.log('info', message, context, category);
  }

  warn(message: string, context?: Record<string, unknown>, category?: string) {
    this.log('warn', message, context, category);
  }

  error(message: string, context?: Record<string, unknown>, category?: string) {
    this.log('error', message, context, category);
  }

  /// Gets recent log entries (for debugging)
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.entries.slice(-count);
  }

  /// Clears old log entries
  clearOldLogs(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - olderThanMs;
    const originalLength = this.entries.length;
    this.entries = this.entries.filter(entry => entry.timestamp > cutoff);
    return originalLength - this.entries.length;
  }
}

export const logger = new DocsLogger();

/// Error handler that converts various error types to appropriate HTTP responses
export function handleError(error: unknown, context: ErrorContext): {
  status: number;
  message: string;
  headers?: Record<string, string>;
} {
  if (error instanceof SecurityValidationError) {
    logger.error('Security validation failed', {
      error: error.message,
      context,
      errors: error.errors
    }, 'SECURITY');

    return {
      status: 400,
      message: `Validation error: ${error.message}`
    };
  }

  if (error instanceof RateLimitError) {
    logger.warn('Rate limit exceeded', {
      error: error.message,
      context: error.context,
      limit: error.limit,
      window: error.window
    }, 'RATE_LIMIT');

    return {
      status: 429,
      message: error.message,
      headers: {
        'Retry-After': Math.ceil(error.window / 1000).toString()
      }
    };
  }

  if (error instanceof NetworkError) {
    logger.error('Network error occurred', {
      error: error.message,
      statusCode: error.statusCode,
      url: error.url,
      context: error.context
    }, 'NETWORK');

    return {
      status: error.statusCode === 404 ? 404 : 503,
      message: error.statusCode === 404 ? 'Package not found' : 'Service temporarily unavailable'
    };
  }

  if (error instanceof IPFSError) {
    logger.error('IPFS error occurred', {
      error: error.message,
      hash: error.hash,
      gateway: error.gateway,
      context: error.context
    }, 'IPFS');

    return {
      status: 503,
      message: 'Documentation temporarily unavailable'
    };
  }

  if (error instanceof DocsError) {
    logger.error('Documentation system error', {
      error: error.message,
      category: error.category,
      severity: error.severity,
      code: error.code,
      context: error.context
    }, error.category.toUpperCase());

    return {
      status: error.recoverable ? 503 : 500,
      message: error.recoverable ? 'Service temporarily unavailable' : 'Internal server error'
    };
  }

  // Generic error handling
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  logger.error('Unhandled error', {
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    context
  }, 'UNKNOWN');

  return {
    status: 500,
    message: 'Internal server error'
  };
}

/// Creates error context from request information
export function createErrorContext(
  packageName?: string,
  version?: string,
  filePath?: string,
  ipfsHash?: string,
  clientIp?: string,
  userAgent?: string,
  requestId?: string
): ErrorContext {
  return {
    packageName,
    version,
    filePath,
    ipfsHash,
    clientIp,
    userAgent,
    timestamp: Date.now(),
    requestId
  };
}

/// Metrics collection for error monitoring
interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recentErrors: DocsError[];
}

class ErrorMetricsCollector {
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByCategory: {},
    errorsBySeverity: {},
    recentErrors: []
  };

  recordError(error: DocsError) {
    this.metrics.totalErrors++;
    
    this.metrics.errorsByCategory[error.category] = 
      (this.metrics.errorsByCategory[error.category] || 0) + 1;
    
    this.metrics.errorsBySeverity[error.severity] = 
      (this.metrics.errorsBySeverity[error.severity] || 0) + 1;

    this.metrics.recentErrors.push(error);
    
    // Keep only the most recent 100 errors
    if (this.metrics.recentErrors.length > 100) {
      this.metrics.recentErrors.shift();
    }
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      recentErrors: []
    };
  }
}

export const errorMetrics = new ErrorMetricsCollector();