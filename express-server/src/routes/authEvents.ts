import { Response } from "express";
import { RequestWithLogger } from "src/types/request";
import { verifyUser } from "../Firebase";
import { DecodedIdToken } from "firebase-admin/auth";
import { sendError } from "./sendError";
import { z } from "zod";
import { getAnalytics, CommonEvents } from "tttc-common/analytics";

const authEventRequest = z.object({
  event: z.enum(["signin", "signout"]),
  firebaseAuthToken: z.string().optional(),
  clientTimestamp: z.string().optional(),
});

export default async function authEvents(
  req: RequestWithLogger,
  res: Response,
) {
  req.log.info("Auth event endpoint called");
  try {
    const parsed = authEventRequest.safeParse(req.body);

    if (!parsed.success) {
      req.log.warn("Invalid request format");
      return sendError(res, 400, "Invalid request format", "ValidationError");
    }

    const { event, firebaseAuthToken, clientTimestamp } = parsed.data;

    if (event === "signin" && firebaseAuthToken) {
      const decodedUser: DecodedIdToken = await verifyUser(firebaseAuthToken);

      req.log.info(
        { uid: decodedUser.uid, email: decodedUser.email },
        "User signing in",
      );

      // Track signin event with analytics
      trackAuthEventAnalytics(
        CommonEvents.USER_SIGNIN,
        clientTimestamp,
        decodedUser.uid,
        decodedUser.email,
      );

      res.json({
        success: true,
        message: "Sign in event logged",
        uid: decodedUser.uid,
      });
    } else if (event === "signout") {
      req.log.info("user signing out");

      res.json({
        success: true,
        message: "Sign out event logged",
      });
    } else {
      return sendError(
        res,
        400,
        "Invalid event or missing token",
        "ValidationError",
      );
    }
  } catch (error) {
    req.log.error(error, "Error logging auth event");
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    sendError(res, 500, message, "AuthEventError");
  }
}

async function trackAuthEventAnalytics(
  event: string,
  timestamp: string | undefined,
  decodedUserId: string,
  decodedUserEmail?: string,
) {
  const analytics = getAnalytics();
  if (analytics) {
    await analytics.track({
      name: event,
      properties: {
        clientTimestamp: timestamp || new Date().toISOString(),
      },
      context: {
        user: {
          userId: decodedUserId,
          email: decodedUserEmail,
        },
      },
    });
  }
}
