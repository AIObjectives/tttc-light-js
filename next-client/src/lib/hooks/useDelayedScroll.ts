import { useRef, useEffect, useCallback } from "react";

/**
 * Hook for scrolling to elements after React state updates complete.
 *
 * Uses double requestAnimationFrame pattern to ensure:
 * 1. React has flushed all state updates
 * 2. Browser has completed layout/paint
 * 3. Target element is visible and positioned correctly
 *
 * Includes AbortController cleanup to prevent stale scroll attempts
 * when component unmounts or multiple scrolls are triggered rapidly.
 *
 * @param setScrollTo - Function to set the scroll target in ReportContext
 * @returns scrollToAfterRender - Function to trigger delayed scroll to a target ID
 *
 * @example
 * ```tsx
 * const { setScrollTo } = useContext(ReportContext);
 * const scrollToAfterRender = useDelayedScroll(setScrollTo);
 *
 * const handleClick = () => {
 *   setActiveContentTab("report");
 *   onNavigateToSubtopic(subtopicId);
 *   scrollToAfterRender(subtopicId);
 * };
 * ```
 */
export function useDelayedScroll(
  setScrollTo: (value: [string, number]) => void,
) {
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount - abort any pending RAF callbacks
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const scrollToAfterRender = useCallback(
    (targetId: string) => {
      // Abort any existing pending RAF callbacks
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this scroll request
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      // Use double RAF to ensure state updates and rendering complete
      requestAnimationFrame(() => {
        // Check if aborted between outer and inner RAF
        if (signal.aborted) return;

        requestAnimationFrame(() => {
          // Only trigger scroll if not aborted (component still mounted)
          if (!signal.aborted) {
            setScrollTo([targetId, Date.now()]);
          }
        });
      });
    },
    [setScrollTo],
  );

  return scrollToAfterRender;
}
