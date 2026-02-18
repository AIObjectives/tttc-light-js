"use client";

import { useUserCapabilitiesQuery } from "@/components/create/hooks/useUserCapabilitiesQuery";
import { Spinner } from "@/components/elements";
import {
  ElicitationEventDetail,
  ElicitationNoAccess,
} from "@/components/elicitation";
import { Center } from "@/components/layout";
import { useUserQuery } from "@/lib/query/useUserQuery";

export default function ElicitationEventPage({
  params,
}: {
  params: { id: string };
}) {
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
    return (
      <Center>
        <p>Please login to view this event</p>
      </Center>
    );
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

  return (
    <div className="fixed inset-0 top-16 overflow-auto">
      <ElicitationEventDetail eventId={params.id} />
    </div>
  );
}
