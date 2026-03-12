import type { User } from "firebase/auth";
import { useEffect, useState } from "react";

/**
 * Fetches CSV data from an elicitation event and returns it as a FileList.
 * Used to pre-populate the file input on the create report form.
 */
export function usePrefetchedCsv(
  elicitationEventId: string | null,
  user: User | null | undefined,
  prefillTitle: string | null,
): FileList | undefined {
  const [prefetchedFiles, setPrefetchedFiles] = useState<FileList | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!elicitationEventId || !user) return;

    const fetchCsv = async () => {
      try {
        const authToken = await user.getIdToken();
        const response = await fetch(
          `/api/elicitation/events/${elicitationEventId}/csv`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        if (!response.ok) return;
        const blob = await response.blob();
        const fileName = `${prefillTitle ?? "study"}_responses.csv`;
        const file = new File([blob], fileName, { type: "text/csv" });
        const dt = new DataTransfer();
        dt.items.add(file);
        setPrefetchedFiles(dt.files);
      } catch {
        // User can still upload manually
      }
    };

    fetchCsv();
    // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  }, []);

  return prefetchedFiles;
}
