"use client";

import { Spinner } from "@/components/elements";
import { Center } from "@/components/layout";
import MyReports from "@/components/myReports/MyReports";
import { useUserQuery } from "@/lib/query/useUserQuery";
import { useUserReportsQuery } from "@/lib/query/useUserReportsQuery";

export default function MyReportsPage() {
  const { user, loading: authLoading } = useUserQuery();
  const {
    data: reports,
    isLoading: reportsLoading,
    error,
  } = useUserReportsQuery(user?.uid ?? null);

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
        <p>Please login to see your reports</p>
      </Center>
    );
  }

  if (reportsLoading) {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

  if (error) {
    return (
      <Center>
        <p>There was an issue loading your reports</p>
      </Center>
    );
  }

  return (
    <div className="justify-items-center">
      <MyReports reports={reports ?? []} />
    </div>
  );
}
