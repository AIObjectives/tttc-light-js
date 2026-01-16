"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { logger } from "tttc-common/logger/browser";
import { useUserQuery } from "@/lib/query/useUserQuery";

const visibilityLogger = logger.child({ module: "report-visibility" });

interface VisibilityState {
  isPublic: boolean | null;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing report visibility state and updates.
 * Handles client-side auth and API calls for checking/updating visibility.
 *
 * @param reportId - The Firebase document ID of the report
 * @param initialIsPublic - Optional initial visibility value (from SSR if available)
 * @param initialIsOwner - Optional initial ownership value. If true, skips the API
 *                         fetch since ownership is already known. This optimizes
 *                         performance by avoiding redundant fetches.
 */
export function useReportVisibility(
  reportId: string,
  initialIsPublic?: boolean,
  initialIsOwner?: boolean,
) {
  const { user, loading: authLoading } = useUserQuery();

  const [state, setState] = useState<VisibilityState>({
    isPublic: initialIsPublic ?? null,
    isOwner: initialIsOwner ?? false,
    // Only loading if ownership is not already known
    isLoading: initialIsOwner === undefined,
    error: null,
  });

  // Fetch visibility status with auth to determine ownership
  const fetchVisibility = useCallback(async () => {
    // Skip fetch if ownership is already determined
    if (initialIsOwner !== undefined) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    if (authLoading) {
      return;
    }
    if (!user) {
      // Not logged in - can't be owner, visibility doesn't matter for UI
      setState((prev) => ({
        ...prev,
        isOwner: false,
        isLoading: false,
      }));
      return;
    }

    try {
      const token = await user.getIdToken();

      const response = await fetch(`/api/report/${reportId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.status}`);
      }

      const data = await response.json();

      setState({
        isPublic: data.metadata?.isPublic ?? null,
        isOwner: data.isOwner ?? false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      visibilityLogger.error({ error, reportId }, "Failed to fetch visibility");
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch visibility",
      }));
    }
  }, [reportId, user, authLoading, initialIsOwner]);

  // Fetch visibility on mount and when auth changes
  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  // Update visibility
  const updateVisibility = useCallback(
    async (isPublic: boolean): Promise<boolean> => {
      if (!user) {
        toast.error("You must be signed in to change visibility");
        return false;
      }

      if (!state.isOwner) {
        toast.error("Only the report owner can change visibility");
        return false;
      }

      // Note: We don't set isLoading here because the component tracks
      // its own isUpdating state. isLoading is for initial ownership check.

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/report/${reportId}/visibility`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isPublic }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Failed to update visibility: ${response.status}`,
          );
        }

        const data = await response.json();

        setState((prev) => ({
          ...prev,
          isPublic: data.isPublic,
          isLoading: false,
          error: null,
        }));

        // Note: Toast is shown by the calling component (ShareDropdown)
        // to allow customized messaging per context

        return true;
      } catch (error) {
        visibilityLogger.error(
          { error, reportId, isPublic },
          "Failed to update visibility",
        );
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update visibility",
        }));
        toast.error("Failed to update visibility");
        return false;
      }
    },
    [reportId, user, state.isOwner],
  );

  return {
    isPublic: state.isPublic,
    isOwner: state.isOwner,
    isLoading: state.isLoading || authLoading,
    error: state.error,
    updateVisibility,
    refetch: fetchVisibility,
  };
}
