import { NextResponse } from "next/server";

/**
 * Health check endpoint for Cloud Run liveness/startup probes
 * Returns 200 if the Next.js server is running
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
