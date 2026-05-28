import { notFound } from "next/navigation";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";
import {
  initializeFeatureFlags,
  isFeatureEnabled,
} from "@/lib/feature-flags/featureFlags.server";
import { getPostHogDistinctId } from "@/lib/feature-flags/getPostHogDistinctId";
import WorkWithUsRedesign from "@/components/workwithus/WorkWithUsRedesign";

export const dynamic = "force-dynamic";

export default async function WorkWithUsPage() {
  initializeFeatureFlags();
  const distinctId = await getPostHogDistinctId();
  const redesignEnabled = await isFeatureEnabled("website-redesign", {
    userId: distinctId,
  });

  if (!redesignEnabled) {
    notFound();
  }

  const analytics = await serverSideAnalyticsClient();
  await analytics.page("Work With Us");

  return <WorkWithUsRedesign />;
}
