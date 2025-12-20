import pRetry from "p-retry";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getUserCapabilities } from "@/lib/api/userLimits";

const DEFAULT_SIZE_LIMIT = 150 * 1024; // 150KB

/**
 * Shared hook to fetch user capabilities and avoid duplicate API calls
 * Includes retry logic and proper error handling
 */
export function useUserCapabilities() {
  const [userSizeLimit, setUserSizeLimit] =
    useState<number>(DEFAULT_SIZE_LIMIT); // Default 150KB
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCapabilities = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const capabilities = await pRetry(
        async () => {
          const result = await getUserCapabilities();
          return result;
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 8000,
          onFailedAttempt: (error) => {
            console.log(
              `Retrying capabilities fetch (attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber}) - ${error.message}`,
            );
          },
        },
      );

      if (capabilities) {
        setUserSizeLimit(capabilities.csvSizeLimit);
        setCapabilitiesLoaded(true);
      } else {
        // User not authenticated or capabilities unavailable
        // Use defaults but mark as loaded
        setCapabilitiesLoaded(true);
      }
    } catch (error) {
      console.error("Failed to load user capabilities after retries:", error);
      setError(error instanceof Error ? error : new Error("Unknown error"));

      // Max retries reached, show user feedback
      toast.error("Unable to load enhanced upload limits", {
        description: `Using default ${(DEFAULT_SIZE_LIMIT / 1024).toFixed(0)}KB limit. You can still upload files.`,
        position: "top-center",
      });
      setCapabilitiesLoaded(true); // Mark as loaded even on failure to unblock UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  return {
    userSizeLimit,
    capabilitiesLoaded,
    isLoading,
    error,
    retry: fetchCapabilities,
  };
}
