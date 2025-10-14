"use server";

import {
  createAnalyticsConfig,
  AnalyticsConfig,
  initializeAnalytics,
  getAnalytics,
} from "tttc-common/analytics";

const config: AnalyticsConfig = createAnalyticsConfig(
  process.env.NODE_ENV === "development" ? "local" : "posthog",
  process.env.ANALYTICS_API_KEY,
  {
    host: process.env.ANALYTICS_HOST,
    enabled: Boolean(process.env.ANALYTICS_ENABLED),
    flushAt: Number(process.env.ANALYTICS_FLUSH_AT),
    flushInterval: Number(process.env.ANALYTICS_FLUSH_INTERVAL),
  },
);

export async function serverSideAnalyticsClient() {
  await initializeAnalytics(config);
  const analytics = getAnalytics();
  return analytics;
}
