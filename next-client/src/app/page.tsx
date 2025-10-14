import Landing from "@/components/landing/Landing";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";

export function generateStaticParams() {
  return [{ slug: [""] }];
}

export default async function HomePage() {
  const analytics = await serverSideAnalyticsClient();
  await analytics.page("Home");
  return (
    <div>
      <Landing />
    </div>
  );
}
