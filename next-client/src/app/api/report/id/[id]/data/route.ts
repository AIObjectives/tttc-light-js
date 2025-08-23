import { NextResponse } from "next/server";
import { logger } from "tttc-common/logger/browser";
import { FIRESTORE_ID_REGEX } from "tttc-common/utils";

export async function GET(
  request: Request,
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

    logger.debug(`REPORT API: Fetching report data for ID: ${id}`);

    // Call the express server's report ID endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";

    const expressResponse = await fetch(`${expressUrl}/report/id/${id}/data`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    logger.debug(
      `REPORT API: Express server response status: ${expressResponse.status}`,
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse.text().catch(() => null);
      return NextResponse.json(
        { error: errorData || "Failed to fetch report" },
        { status: expressResponse.status },
      );
    }

    const result = await expressResponse.json();

    // Express returns { url: signedUrl }, we need to fetch the actual data
    if (result.url) {
      logger.debug("REPORT API: Fetching data from signed URL");
      const dataResponse = await fetch(result.url);

      if (!dataResponse.ok) {
        logger.error(
          `Failed to fetch data from signed URL: ${dataResponse.status}`,
        );
        return NextResponse.json(
          { error: "Failed to fetch report data from storage" },
          { status: dataResponse.status },
        );
      }

      const reportData = await dataResponse.json();
      logger.debug("REPORT API: Report data fetched successfully");
      return NextResponse.json(reportData);
    }

    // Fallback for legacy or error cases
    logger.debug("REPORT API: No URL provided, returning result as-is");
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, "Error in report data API");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
