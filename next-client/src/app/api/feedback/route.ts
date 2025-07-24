import { feedbackRequest } from "@/lib/types/clientRoutes";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { logger } from "tttc-common/logger";

export async function POST(request: Request) {
  logger.info("FEEDBACK API: Feedback POST request received");
  try {
    const json = await request.json();
    const parsed = feedbackRequest.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { response: ["error", { message: "Invalid request format" }] },
        { status: 400 },
      );
    }

    const headersList = await headers();
    const authorization = headersList.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      logger.warn("FEEDBACK API: No valid Authorization header found");
      return NextResponse.json(
        { response: ["error", { message: "Unauthorized - missing token" }] },
        { status: 401 },
      );
    }

    const token = authorization.split("Bearer ")[1];
    logger.debug(
      "FEEDBACK API: Got token, calling express server feedback endpoint",
    );

    // Call the express server's feedback endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    logger.debug(`FEEDBACK API: Calling ${expressUrl}/feedback`);

    const expressResponse = await fetch(`${expressUrl}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: parsed.data.text,
        firebaseAuthToken: token,
      }),
    });

    logger.debug(
      `FEEDBACK API: Express server response status: ${expressResponse.status}`,
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse.json().catch(() => ({}));
      logger.error(
        `FEEDBACK API: Express server error: ${expressResponse.status}`,
        errorData,
      );
      return NextResponse.json(
        { response: ["error", { message: "Failed to submit feedback" }] },
        { status: 500 },
      );
    }

    const result = await expressResponse.json();
    logger.info(
      "FEEDBACK API: Feedback submitted successfully via express server",
    );
    return NextResponse.json({
      response: ["data", "success"],
    });
  } catch (error) {
    logger.error("FEEDBACK API: Failed to submit feedback:", error);
    return NextResponse.json(
      { response: ["error", { message: "An error occurred" }] },
      { status: 500 },
    );
  }
}
