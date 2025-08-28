import { feedbackRequest } from "@/lib/types/clientRoutes";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { logger } from "tttc-common/logger/browser";

const feedbackApiLogger = logger.child({ module: "api-feedback" });

export async function POST(request: Request) {
  feedbackApiLogger.info({ req: request }, "Feedback POST request received");
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
      feedbackApiLogger.warn(
        { req: request },
        "No valid Authorization header found",
      );
      return NextResponse.json(
        { response: ["error", { message: "Unauthorized - missing token" }] },
        { status: 401 },
      );
    }

    const token = authorization.split("Bearer ")[1];
    feedbackApiLogger.debug(
      {},
      "Got token, calling express server feedback endpoint",
    );

    // Call the express server's feedback endpoint
    const expressUrl =
      process.env.PIPELINE_EXPRESS_URL || "http://localhost:8080";
    feedbackApiLogger.debug(
      { expressUrl },
      "Calling express server feedback endpoint",
    );

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

    feedbackApiLogger.debug(
      { status: expressResponse.status },
      "Express server response received",
    );

    if (!expressResponse.ok) {
      const errorData = await expressResponse.json().catch(() => ({}));
      feedbackApiLogger.error(
        {
          status: expressResponse.status,
          errorData,
        },
        "Express server error",
      );
      return NextResponse.json(
        { response: ["error", { message: "Failed to submit feedback" }] },
        { status: 500 },
      );
    }

    const result = await expressResponse.json();
    feedbackApiLogger.info(
      {},
      "Feedback submitted successfully via express server",
    );
    return NextResponse.json({
      response: ["data", "success"],
    });
  } catch (error) {
    feedbackApiLogger.error({ error }, "Failed to submit feedback");
    return NextResponse.json(
      { response: ["error", { message: "An error occurred" }] },
      { status: 500 },
    );
  }
}
