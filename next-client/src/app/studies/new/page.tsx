"use client";

import { useUserCapabilitiesQuery } from "@/components/create/hooks/useUserCapabilitiesQuery";
import { Spinner } from "@/components/elements";
import { ElicitationNoAccess } from "@/components/elicitation";
import { CreateStudyForm } from "@/components/elicitation/CreateStudyForm";
import { Center } from "@/components/layout";
import { useUserQuery } from "@/lib/query/useUserQuery";

export default function CreateStudyPage() {
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
        <p>Please login to create a study</p>
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
      <CreateStudyForm />
    </div>
  );
}
