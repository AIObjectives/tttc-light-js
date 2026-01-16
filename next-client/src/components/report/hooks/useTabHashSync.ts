import { useEffect, useRef } from "react";

type ContentTab = "report" | "cruxes";

/**
 * Custom hook to synchronize tab state with URL hash.
 * Handles bidirectional sync: URL ↔ State
 *
 * @param activeContentTab - Current active tab
 * @param setActiveContentTab - Function to update active tab
 * @param hasControversyData - Whether controversy data is available
 */
export function useTabHashSync(
  activeContentTab: ContentTab,
  setActiveContentTab: (tab: ContentTab) => void,
  hasControversyData: boolean,
) {
  // Track the source of tab changes to prevent circular updates between URL and state
  const tabChangeSource = useRef<"user" | "hash">("user");

  // URL hash synchronization constants
  const HASH_SYNC_DEBOUNCE_MS = 50; // Debounce browser back/forward spam

  // Effect 1: Sync tab from URL hash (URL → State)
  // This handles initial load and browser back/forward navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeContentTab intentionally excluded - including it causes infinite loop (effect sets tab → triggers effect)
  useEffect(() => {
    let debounceTimeout: number | null = null;

    const syncFromHash = () => {
      // Clear any pending debounce
      if (debounceTimeout) clearTimeout(debounceTimeout);

      debounceTimeout = setTimeout(() => {
        try {
          const hash = window.location.hash.slice(1);
          const expectedTab: ContentTab =
            hash === "cruxes" && hasControversyData ? "cruxes" : "report";

          // Mark this update as coming from hash to prevent circular updates
          tabChangeSource.current = "hash";

          // Determine the new tab value
          let newTab: ContentTab = expectedTab;
          // Force report tab if controversy data disappeared
          if (!hasControversyData && activeContentTab === "cruxes") {
            newTab = "report";
          }

          // Only update if tab needs to change
          if (newTab !== activeContentTab) {
            setActiveContentTab(newTab);
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error syncing tab from hash:", error);
          }
        }
        debounceTimeout = null;
      }, HASH_SYNC_DEBOUNCE_MS) as unknown as number;
    };

    // Sync from URL on mount
    syncFromHash();

    // Listen for hash changes (browser back/forward)
    window.addEventListener("hashchange", syncFromHash);

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, [hasControversyData, setActiveContentTab]);

  // Effect 2: Update URL when tab changes (State → URL)
  // This handles user clicking on tab switches
  useEffect(() => {
    // Skip URL update if change came from hash sync (prevents circular updates)
    if (tabChangeSource.current === "hash") {
      tabChangeSource.current = "user"; // Reset for next update
      return;
    }

    const currentHash = window.location.hash.slice(1);
    const expectedHash = activeContentTab === "cruxes" ? "cruxes" : "";

    // Only update URL if it doesn't match current state
    if (currentHash !== expectedHash) {
      if (expectedHash) {
        window.history.pushState(null, "", `#${expectedHash}`);
      } else {
        // Remove hash when on report tab
        window.history.pushState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
    }
  }, [activeContentTab]);
}
