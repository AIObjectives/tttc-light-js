import { User } from "firebase/auth";
import { fetchToken } from "./getIdToken";
import { logger } from "tttc-common/logger";

/**
 * Log authentication events to the server for proper monitoring
 * This ensures auth events are logged server-side where they can be monitored and secured
 */
export async function logAuthEvent(
  event: "signin" | "signout",
  user?: User,
): Promise<void> {
  try {
    let body: {
      event: "signin" | "signout";
      clientTimestamp: string;
      token?: string;
    } = {
      event,
      clientTimestamp: new Date().toISOString(),
    };

    // For signin events, include the Firebase token for verification
    if (event === "signin" && user) {
      const tokenResult = await fetchToken(user);
      if (tokenResult.tag === "success" && tokenResult.value) {
        body.token = tokenResult.value;
      } else {
        logger.warn(
          "[UserAccount] CLIENT: Could not get token for signin event logging",
        );
        return;
      }
    }

    // Call our Next.js API route which will proxy to the express server
    const response = await fetch("/api/auth-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.warn(
        `[UserAccount] CLIENT: Failed to log ${event} event to server:`,
        response.status,
      );
    } else {
      logger.info(`CLIENT: ${event} event logged to server successfully`);
    }
  } catch (error) {
    logger.warn(
      `[UserAccount] CLIENT: Error logging ${event} event to server:`,
      error,
    );
  }
}
