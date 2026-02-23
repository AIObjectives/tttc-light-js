"use client";

import { useEffect, useState } from "react";
import { useUserQuery } from "@/lib/query/useUserQuery";

interface EventReport {
  id: string;
  title: string;
  createdDate: Date;
  status?: string;
}

interface UseEventReportsResult {
  reports: EventReport[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Parse a date value that may be an ISO string or a serialized Firestore Timestamp.
 * Firestore Timestamps serialize to JSON as { _seconds, _nanoseconds } when not
 * parsed through the Zod schema.
 */
function parseReportDate(value: unknown): Date {
  if (typeof value === "string") {
    return new Date(value);
  }
  if (value !== null && typeof value === "object") {
    const ts = value as Record<string, unknown>;
    const seconds = ts._seconds ?? ts.seconds;
    if (typeof seconds === "number") {
      return new Date(seconds * 1000);
    }
  }
  return new Date(value as string | number);
}

/**
 * Fetch report metadata for multiple report IDs.
 * Returns minimal report info for timeline display.
 */
export function useEventReports(reportIds?: string[]): UseEventReportsResult {
  const { user } = useUserQuery();
  const [reports, setReports] = useState<EventReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!reportIds || reportIds.length === 0) {
      setReports([]);
      setIsLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        setIsLoading(true);
        setIsError(false);

        const authToken = user ? await user.getIdToken() : undefined;

        // Fetch all reports in parallel
        const reportPromises = reportIds.map(async (reportId) => {
          try {
            const response = await fetch(`/api/report/${reportId}`, {
              headers: authToken
                ? { Authorization: `Bearer ${authToken}` }
                : {},
            });
            if (!response.ok) {
              return null;
            }
            const data = await response.json();

            // Express returns { metadata: ReportRef, status, ... }
            const reportData = data.metadata || data;

            return {
              id: reportId,
              title: reportData.title || "Untitled Report",
              createdDate: parseReportDate(reportData.createdDate),
              status: reportData.status,
            };
          } catch (err) {
            console.error(`Failed to fetch report ${reportId}:`, err);
            return null;
          }
        });

        const fetchedReports = await Promise.all(reportPromises);

        // Filter out null values and ensure type safety
        const validReports = fetchedReports.filter(
          (r) => r !== null,
        ) as EventReport[];

        // Sort by creation date, newest first
        validReports.sort(
          (a, b) => b.createdDate.getTime() - a.createdDate.getTime(),
        );

        setReports(validReports);
      } catch (err) {
        setIsError(true);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch reports"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [reportIds, user]);

  return { reports, isLoading, isError, error };
}
