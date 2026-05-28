"use client";

import { useUserCapabilitiesQuery } from "@/components/create/hooks/useUserCapabilitiesQuery";
import { Spinner } from "@/components/elements";
import { ElicitationNoAccess } from "@/components/elicitation";
import ElicitationTrackingContent from "@/components/elicitation/ElicitationTrackingContent";
import { Center } from "@/components/layout";
import { useUserQuery } from "@/lib/query/useUserQuery";

export default function StudiesPage() {
  const { user, loading: authLoading } = useUserQuery();
  const { canViewElicitationTracking, capabilitiesLoaded } =
    useUserCapabilitiesQuery();

  if (authLoading) {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

  if (!user) {
    return <ElicitationNoAccess />;
  }

  if (!capabilitiesLoaded) {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

  if (!canViewElicitationTracking) {
    return <ElicitationNoAccess />;
  }

  return <ElicitationTrackingContent />;
}
