"use client";

import { useMemo } from "react";
import { Spinner } from "@/components/elements";
import { Center } from "@/components/layout";
import MyReports from "@/components/myReports/MyReports";
import NoReportsEmptyState from "@/components/myReports/NoReportsEmptyState";
import { useFeatureFlagQuery } from "@/lib/query/useFeatureFlagQuery";
import { useUserQuery } from "@/lib/query/useUserQuery";
import { useUserReportsQuery } from "@/lib/query/useUserReportsQuery";

export default function MyReportsPage() {
  const { user, loading: authLoading } = useUserQuery();
  const {
    data: reports,
    isLoading: reportsLoading,
    error,
  } = useUserReportsQuery(user?.uid ?? null);
  const flagContext = useMemo(
    () => (user?.uid ? { userId: user.uid } : undefined),
    [user?.uid],
  );
  const { enabled: redesignEnabled } = useFeatureFlagQuery(
    "website-redesign",
    flagContext,
  );

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

  const reportsList = reports ?? [];

  if (redesignEnabled && reportsList.length === 0) {
    return <NoReportsEmptyState />;
  }

  return (
    <div className="justify-items-center">
      <MyReports reports={reportsList} />
    </div>
  );
}
