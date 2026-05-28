import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrivacyRedesign from "@/components/privacy/PrivacyRedesign";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";
import {
  initializeFeatureFlags,
  isFeatureEnabled,
} from "@/lib/feature-flags/featureFlags.server";
import { getPostHogDistinctId } from "@/lib/feature-flags/getPostHogDistinctId";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy and Security - Talk to the City",
  description:
    "How Talk to the City collects, handles, protects, and shares your data.",
};

export default async function PrivacyPage() {
  initializeFeatureFlags();
  const distinctId = await getPostHogDistinctId();
  const redesignEnabled = await isFeatureEnabled("website-redesign", {
    userId: distinctId,
  });

  if (!redesignEnabled) {
    notFound();
  }

  const analytics = await serverSideAnalyticsClient();
  await analytics.page("Privacy and Security");

  return <PrivacyRedesign />;
}
