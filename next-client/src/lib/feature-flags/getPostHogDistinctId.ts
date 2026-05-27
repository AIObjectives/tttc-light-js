import { cookies } from "next/headers";
import { logger } from "tttc-common/logger";

const cookieLogger = logger.child({ module: "feature-flags-cookie" });

// PostHog stores per-user state in a JSON cookie named `ph_<api-key>_posthog`.
// Server components need to read this to evaluate per-user feature flags via the
// Node SDK — otherwise every request is treated as the same anonymous visitor
// and per-user targeting rules can never match.
export async function getPostHogDistinctId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const phCookie = cookieStore
    .getAll()
    .find((c) => c.name.startsWith("ph_") && c.name.endsWith("_posthog"));

  if (!phCookie) return undefined;

  // posthog-js stores the cookie value as encodeURIComponent(JSON.stringify(state)).
  try {
    const parsed = JSON.parse(decodeURIComponent(phCookie.value));
    if (
      typeof parsed?.distinct_id === "string" &&
      parsed.distinct_id.length > 0
    ) {
      return parsed.distinct_id;
    }
  } catch (error) {
    cookieLogger.warn({ error }, "Failed to parse PostHog cookie");
  }
  return undefined;
}
