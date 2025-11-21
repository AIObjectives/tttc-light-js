"use client";

import CreateReport from "@/components/create/CreateReport";
import { useUser } from "@/lib/hooks/getUser";
import { Center } from "@/components/layout";

export default function ReportCreationPage() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <Center>
        <p>Loading...</p>
      </Center>
    );
  }

  if (user === null) {
    return (
      <Center>
        <p>Please login to create a report</p>
      </Center>
    );
  }

  return (
    <div className="m-auto max-w-[832px] p-2 mt-4">
      <CreateReport />
    </div>
  );
}
