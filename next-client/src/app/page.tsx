import Feedback from "@/components/feedback/Feedback";
import Landing from "@/components/landing/Landing";
import LandingRedesign from "@/components/landing/LandingRedesign";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";
import {
  initializeFeatureFlags,
  isFeatureEnabled,
} from "@/lib/feature-flags/featureFlags.server";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [{ slug: [""] }];
}

export default async function HomePage() {
  initializeFeatureFlags();
  const analytics = await serverSideAnalyticsClient();
  await analytics.page("Home");
  const redesignEnabled = await isFeatureEnabled("website-redesign");
  return (
    <div>
      {redesignEnabled ? <LandingRedesign /> : <Landing />}
      <Feedback />
    </div>
  );
}
