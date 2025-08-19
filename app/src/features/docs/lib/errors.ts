/// Simple error handling utilities for documentation system
/// Follows existing forc.pub patterns with minimal docs-specific additions

/// Creates a standardized error response for documentation routes
export function createErrorResponse(
  message: string, 
  status: number,
  headers?: Record<string, string>
): { message: string; status: number; headers?: Record<string, string> } {
  return { message, status, headers };
}

/// Logs errors with consistent format (similar to HTTP interceptor)
export function logError(context: string, error: unknown, details?: Record<string, unknown>): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (details) {
    console.error(`${context}:`, errorMessage, details);
  } else {
    console.error(`${context}:`, errorMessage);
  }
}

/// Standard rate limit error response
export function createRateLimitResponse(): { message: string; status: number; headers: Record<string, string> } {
  return {
    message: 'Too Many Requests',
    status: 429,
    headers: { 'Retry-After': '60' }
  };
}