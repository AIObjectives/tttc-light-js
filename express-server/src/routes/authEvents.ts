import type { Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { RequestWithLogger } from "src/types/request";
import { CommonEvents, getAnalytics } from "tttc-common/analytics";
import { ERROR_CODES } from "tttc-common/errors";
import { z } from "zod";
import { verifyUser } from "../Firebase";
import { sendErrorByCode } from "./sendError";

const authEventRequest = z.object({
  event: z.enum(["signin", "signout"]),
  clientTimestamp: z.string().optional(),
});

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

export default async function authEvents(
  req: RequestWithLogger,
  res: Response,
) {
  req.log.info("Auth event endpoint called");
  try {
    const parsed = authEventRequest.safeParse(req.body);

    if (!parsed.success) {
      req.log.warn("Invalid request format");
      return sendErrorByCode(res, ERROR_CODES.VALIDATION_ERROR, req.log);
    }

    const { event, clientTimestamp } = parsed.data;

    if (event === "signin") {
      // Signin requires valid Authorization header
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        req.log.warn("Missing Authorization header for signin event");
        return sendErrorByCode(res, ERROR_CODES.AUTH_TOKEN_MISSING, req.log);
      }

      const decodedUser: DecodedIdToken = await verifyUser(token);

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
      return sendErrorByCode(res, ERROR_CODES.VALIDATION_ERROR, req.log);
    }
  } catch (error) {
    req.log.error(error, "Error logging auth event");
    // Token verification errors should return auth error, not internal error
    const isAuthError =
      error instanceof Error &&
      (error.message.toLowerCase().includes("token") ||
        error.message.toLowerCase().includes("auth"));
    sendErrorByCode(
      res,
      isAuthError ? ERROR_CODES.AUTH_TOKEN_INVALID : ERROR_CODES.INTERNAL_ERROR,
      req.log,
    );
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
