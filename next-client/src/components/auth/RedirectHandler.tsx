"use client";

import { useEffect, useRef } from "react";
import { handleRedirectResult } from "@/lib/firebase/auth";
import { logAuthEvent } from "@/lib/firebase/authEvents";
import { logger } from "tttc-common/logger/browser";

const redirectLogger = logger.child({ module: "redirect-handler" });

/**
 * Handles the redirect result from Google sign-in.
 * This component should be included in the root layout to process
 * sign-in redirects after the user returns from Google's auth page.
 */
export function RedirectHandler() {
  // Use ref to prevent double execution in development strict mode
  const hasCheckedRedirect = useRef(false);

  useEffect(() => {
    // Skip if already checked (prevents duplicate logs in dev mode)
    if (hasCheckedRedirect.current) return;
    hasCheckedRedirect.current = true;

    const checkRedirectResult = async () => {
      try {
        redirectLogger.debug({}, "Checking for redirect result");
        const result = await handleRedirectResult();

        if (result) {
          // User successfully signed in via redirect
          redirectLogger.info(
            {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
            },
            "Google sign-in redirect completed successfully",
          );

          // Log signin event to server
          await logAuthEvent("signin", result.user);
        } else {
          // No pending redirect result (normal page load)
          redirectLogger.debug({}, "No pending redirect result");
        }
      } catch (error) {
        // Error handling - could be expired link, user cancelled, etc.
        redirectLogger.error(
          { error },
          "Error processing Google sign-in redirect",
        );
      }
    };

    checkRedirectResult();
  }, []);

  // This component doesn't render anything
  return null;
}
