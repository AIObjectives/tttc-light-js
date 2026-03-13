"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUserCapabilitiesQuery } from "@/components/create/hooks/useUserCapabilitiesQuery";
import { Spinner } from "@/components/elements";
import {
  EditStudyForm,
  ElicitationNoAccess,
} from "@/components/elicitation";
import { Center } from "@/components/layout";
import { useElicitationEvent } from "@/lib/hooks/useElicitationEvent";
import { useUserQuery } from "@/lib/query/useUserQuery";

function getStudyStatus(
  eventInitialized: boolean | undefined,
  responderCount: number,
  expectedParticipantCount: number | undefined,
): "completed" | "in-progress" | "waiting" {
  if (
    (expectedParticipantCount !== undefined &&
      responderCount >= expectedParticipantCount) ||
    (!eventInitialized && responderCount > 0)
  ) {
    return "completed";
  }
  if (
    eventInitialized &&
    responderCount < (expectedParticipantCount ?? Infinity)
  ) {
    return "in-progress";
  }
  return "waiting";
}

export default function EditStudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useUserQuery();
  const { canViewElicitationTracking, capabilitiesLoaded } =
    useUserCapabilitiesQuery();
  const { event, isLoading: eventLoading } = useElicitationEvent(id);

  // Redirect if study is not in waiting state
  useEffect(() => {
    if (!event) return;
    const status = getStudyStatus(
      event.eventInitialized,
      event.responderCount,
      event.expectedParticipantCount,
    );
    if (status !== "waiting") {
      router.replace(`/elicitation/${id}`);
    }
  }, [event, id, router]);

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
        <p>Please login to edit a study</p>
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

  if (eventLoading || !event) {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

  return (
    <div className="fixed inset-0 top-16 overflow-auto">
      <EditStudyForm event={event} />
    </div>
  );
}
