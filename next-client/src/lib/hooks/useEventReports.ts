"use client";

import { useEffect, useState } from "react";

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
 * Fetch report metadata for multiple report IDs
 * Returns minimal report info for timeline display
 */
export function useEventReports(reportIds?: string[]): UseEventReportsResult {
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

        // Fetch all reports in parallel
        const reportPromises = reportIds.map(async (reportId) => {
          try {
            const response = await fetch(`/report/${reportId}`);
            if (!response.ok) {
              return null;
            }
            const data = await response.json();

            // Handle both old and new response formats
            const reportData = data.reportRef || data;

            return {
              id: reportId,
              title: reportData.title || "Untitled Report",
              createdDate: new Date(reportData.createdDate),
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
  }, [reportIds]);

  return { reports, isLoading, isError, error };
}
