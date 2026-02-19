import { notFound } from "next/navigation";
import ElicitationTrackingContent from "@/components/elicitation/ElicitationTrackingContent";
import {
  initializeFeatureFlags,
  isFeatureEnabled,
} from "@/lib/feature-flags/featureFlags.server";

export default async function StudiesPage() {
  initializeFeatureFlags();
  const enabled = await isFeatureEnabled("elicitation_enabled");
  if (!enabled) {
    notFound();
  }
  return <ElicitationTrackingContent />;
}
