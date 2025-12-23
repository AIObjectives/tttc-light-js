import type { User } from "firebase/auth";
import { logger } from "tttc-common/logger/browser";
import { fetchToken } from "./getIdToken";

const authEventsLogger = logger.child({ module: "auth-events-client" });

/**
 * Log authentication events to the server for proper monitoring
 * This ensures auth events are logged server-side where they can be monitored and secured
 */
export async function logAuthEvent(
  event: "signin" | "signout",
  user: User,
): Promise<void> {
  try {
    const tokenResult = await fetchToken(user);
    if (tokenResult.tag !== "success" || !tokenResult.value) {
      authEventsLogger.warn(
        { user },
        "Could not get token for auth-event event logging",
      );
      return;
    }

    const body = {
      event,
      clientTimestamp: new Date().toISOString(),
    };

    // Call our Next.js API route which will proxy to the express server
    const response = await fetch("/api/auth-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenResult.value}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      authEventsLogger.warn(
        {
          event,
          status: response.status,
        },
        "Failed to log auth event to server",
      );
    } else {
      authEventsLogger.info(
        { event },
        "Auth event logged to server successfully",
      );
    }
  } catch (error) {
    authEventsLogger.warn(
      {
        event,
        error,
      },
      "Error logging auth event to server",
    );
  }
}
