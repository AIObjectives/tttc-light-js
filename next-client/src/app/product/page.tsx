import { notFound } from "next/navigation";
import ProductRedesign from "@/components/product/ProductRedesign";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";
import {
  initializeFeatureFlags,
  isFeatureEnabled,
} from "@/lib/feature-flags/featureFlags.server";
import { getPostHogDistinctId } from "@/lib/feature-flags/getPostHogDistinctId";

export const dynamic = "force-dynamic";

export default async function ProductPage() {
  initializeFeatureFlags();
  const distinctId = await getPostHogDistinctId();
  const redesignEnabled = await isFeatureEnabled("website-redesign", {
    userId: distinctId,
  });

  if (!redesignEnabled) {
    notFound();
  }

  const analytics = await serverSideAnalyticsClient();
  await analytics.page("Product");

  return <ProductRedesign />;
}
