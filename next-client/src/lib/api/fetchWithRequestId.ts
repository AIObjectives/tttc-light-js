/**
 * Fetch wrapper that automatically adds X-Request-ID header for distributed tracing.
 *
 * The request ID is generated using crypto.randomUUID() which is available in:
 * - Node.js 19+ (used in server components and API routes)
 * - All modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+)
 *
 * This enables end-to-end request correlation from client through express-server
 * to pipeline-worker, making it easier to trace and debug issues across services.
 */

/**
 * Header name for request correlation ID.
 * Using X-Request-ID to align with pino-http convention.
 */
export const REQUEST_ID_HEADER = "X-Request-ID";

/**
 * Generate a unique request ID using crypto.randomUUID().
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Fetch wrapper that automatically adds X-Request-ID header.
 *
 * @param url - The URL to fetch
 * @param options - Standard RequestInit options
 * @returns Promise<Response> - The fetch response
 *
 * @example
 * ```typescript
 * const response = await fetchWithRequestId('/api/report/123', {
 *   method: 'GET',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * ```
 */
export async function fetchWithRequestId(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const requestId = generateRequestId();
  const headers = new Headers(options.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  return fetch(url, { ...options, headers });
}
