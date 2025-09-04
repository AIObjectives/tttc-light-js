import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";
import { FIRESTORE_ID_REGEX } from "tttc-common/utils";

const reportMetadataLogger = logger.child({ module: "report-metadata" });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Validate report ID format
    if (!id || !FIRESTORE_ID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid report ID format" },
        { status: 400 },
      );
    }

    reportMetadataLogger.debug(
      { reportId: id },
      "Fetching metadata for report",
    );

    // Call the express server's report ID metadata endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const expressResponse = await fetch(
      `${expressUrl}/report/id/${id}/metadata`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    reportMetadataLogger.debug(
      { status: expressResponse.status },
      "Express server response received",
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse.text().catch(() => null);
      return NextResponse.json(
        { error: errorData || "Failed to fetch report metadata" },
        { status: expressResponse.status },
      );
    }

    const metadata = await expressResponse.json();
    reportMetadataLogger.debug("Report metadata fetched successfully");

    return NextResponse.json(metadata);
  } catch (error) {
    reportMetadataLogger.error({ error }, "Error in report metadata API");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
