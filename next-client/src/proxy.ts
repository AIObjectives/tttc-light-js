import { type NextRequest, NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";

const proxyLogger = logger.child({ module: "proxy" });

/**
 * API Proxy for forwarding requests to Express backend
 *
 * This replaces individual API route handlers with a single proxy that forwards
 * requests to the Express server. All validation, authentication, and business
 * logic is handled by Express.
 *
 * Runtime environment variable PIPELINE_EXPRESS_URL is read on each request,
 * allowing different values per environment without rebuilding.
 */

// Static route mappings: Next.js path -> Express path
const ROUTE_MAP: Record<string, string> = {
  "/api/user/ensure": "/ensure-user",
  "/api/user/limits": "/api/user/limits",
  "/api/auth-events": "/auth-events",
  "/api/feedback": "/feedback",
  "/api/profile/update": "/api/profile/update",
};

/**
 * Check if a path matches a dynamic report route
 * Returns the Express path if matched, null otherwise
 */
function matchReportRoute(pathname: string): string | null {
  // Match /api/report/:uri/migrate
  const migrateMatch = pathname.match(/^\/api\/report\/([^/]+)\/migrate$/);
  if (migrateMatch) {
    return `/report/${migrateMatch[1]}/migrate`;
  }

  // Match /api/report/:uri
  const reportMatch = pathname.match(/^\/api\/report\/([^/]+)$/);
  if (reportMatch) {
    return `/report/${reportMatch[1]}`;
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if this is an API route we should proxy
  const staticTarget = ROUTE_MAP[pathname];
  const dynamicTarget = matchReportRoute(pathname);
  const targetPath = staticTarget || dynamicTarget;

  // Not a proxied route - continue to Next.js routing
  if (!targetPath) {
    return NextResponse.next();
  }

  // Get Express URL from runtime environment
  const expressUrl = process.env.PIPELINE_EXPRESS_URL;
  if (!expressUrl) {
    proxyLogger.error({}, "PIPELINE_EXPRESS_URL not configured");
    return NextResponse.json(
      { error: "Backend service not configured" },
      { status: 503 },
    );
  }

  // Include query string from original request
  const queryString = request.nextUrl.search;
  const targetUrl = `${expressUrl}${targetPath}${queryString}`;

  try {
    // Forward the request to Express
    // Headers (including Authorization) and query parameters are forwarded
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // Required for streaming request bodies (POST/PUT)
      // @ts-expect-error - duplex is a valid fetch option but not in all TS definitions
      duplex: "half",
    });

    // Create response with Express headers
    const responseHeaders = new Headers(response.headers);

    // Return the proxied response
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    proxyLogger.error({ error }, "Failed to reach backend");
    return NextResponse.json(
      { error: "Backend service unavailable" },
      { status: 503 },
    );
  }
}

// Only run proxy for API routes
export const config = {
  matcher: "/api/:path*",
};
