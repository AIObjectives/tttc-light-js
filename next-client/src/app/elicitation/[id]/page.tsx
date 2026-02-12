"use client";

import { Spinner } from "@/components/elements";
import { ElicitationEventDetail } from "@/components/elicitation";
import { Center } from "@/components/layout";
import { useUserQuery } from "@/lib/query/useUserQuery";

export default function ElicitationEventPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, loading: authLoading } = useUserQuery();

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

  return <ElicitationEventDetail eventId={params.id} />;
}
