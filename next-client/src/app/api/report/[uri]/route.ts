import { NextResponse } from "next/server";

/**
 * GET /api/report/[uri]
 * Returns report metadata and status for a given report ID.
 * Proxies to Express server - auth header forwarded for private report access.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uri: string }> },
) {
  try {
    const { uri: id } = await params;

    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const authHeader = request.headers.get("Authorization");
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const expressResponse = await fetch(
      `${expressUrl}/report/${encodeURIComponent(id)}`,
      { headers },
    );

    if (!expressResponse.ok) {
      const errorBody = await expressResponse
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(errorBody, { status: expressResponse.status });
    }

    const result = await expressResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 },
    );
  }
}
