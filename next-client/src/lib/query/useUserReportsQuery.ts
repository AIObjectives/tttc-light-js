"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReportRef } from "tttc-common/firebase";
import { getFirebaseDb } from "@/lib/firebase/clientApp";
import { getUsersReports } from "@/lib/firebase/firestoreClient";
import { queryKeys } from "./queryKeys";

/**
 * TanStack Query hook for fetching user's reports.
 *
 * @param userId - The user ID to fetch reports for, or null if not authenticated
 * @returns Query result with reports array, loading state, and error
 *
 * @example
 * ```tsx
 * function MyReports() {
 *   const { user } = useUserQuery();
 *   const { data: reports, isLoading, error } = useUserReportsQuery(user?.uid ?? null);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *   return <ReportsList reports={reports} />;
 * }
 * ```
 */
export function useUserReportsQuery(userId: string | null) {
  return useQuery<ReportRef[], Error>({
    // Query is disabled when userId is null, so this key won't be used for fetching
    queryKey: queryKeys.user.reports(userId ?? "anonymous"),
    queryFn: async () => {
      // enabled: userId !== null ensures this only runs with valid userId
      const db = getFirebaseDb();
      const result = await getUsersReports(db, userId!);
      if (result.tag === "failure") {
        throw result.error;
      }
      return result.value;
    },
    enabled: userId !== null,
    // Reports don't change often, but refresh on window focus
    staleTime: 30 * 1000, // 30 seconds
  });
}
