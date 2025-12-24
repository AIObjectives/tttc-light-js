import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { DEVTOOLS_ENABLED } from "./middleware";
import type { ContentTab, ReportUIStore, SortMode } from "./types";

// ============================================
// Initial State
// ============================================

const initialState: Omit<
  ReportUIStore,
  keyof import("./types").ReportUIStoreActions
> = {
  sortMode: "frequent",
  activeContentTab: "report",
  expandedCruxId: null,
  focusedNodeId: null,
  focusedCruxId: null,
  scrollToId: null,
  scrollToTimestamp: 0,
  isMobileOutlineOpen: false,
};

// ============================================
// Store Definition
// ============================================

export const useReportUIStore = create<ReportUIStore>()(
  devtools(
    immer((set) => ({
      // Initial state
      ...initialState,

      // ----------------------------------------
      // Sort Mode
      // ----------------------------------------

      setSortMode: (mode: SortMode) => {
        set((state) => {
          state.sortMode = mode;
        });
      },

      // ----------------------------------------
      // Navigation
      // ----------------------------------------

      setActiveContentTab: (tab: ContentTab) => {
        set((state) => {
          state.activeContentTab = tab;
        });
      },

      setExpandedCruxId: (id: string | null) => {
        set((state) => {
          state.expandedCruxId = id;
        });
      },

      // ----------------------------------------
      // Focus Tracking
      // ----------------------------------------

      setFocusedNodeId: (id: string | null) => {
        set((state) => {
          state.focusedNodeId = id;
        });
      },

      setFocusedCruxId: (id: string | null) => {
        set((state) => {
          state.focusedCruxId = id;
        });
      },

      // ----------------------------------------
      // Scroll Management
      // ----------------------------------------

      scrollTo: (id: string) => {
        set((state) => {
          state.scrollToId = id;
          // Timestamp allows re-triggering scroll to same ID
          state.scrollToTimestamp = Date.now();
        });
      },

      clearScrollTo: () => {
        set((state) => {
          state.scrollToId = null;
        });
      },

      // ----------------------------------------
      // Mobile
      // ----------------------------------------

      setMobileOutlineOpen: (open: boolean) => {
        set((state) => {
          state.isMobileOutlineOpen = open;
        });
      },

      toggleMobileOutline: () => {
        set((state) => {
          state.isMobileOutlineOpen = !state.isMobileOutlineOpen;
        });
      },

      // ----------------------------------------
      // Reset
      // ----------------------------------------

      reset: () => {
        set((state) => {
          state.sortMode = initialState.sortMode;
          state.activeContentTab = initialState.activeContentTab;
          state.expandedCruxId = initialState.expandedCruxId;
          state.focusedNodeId = initialState.focusedNodeId;
          state.focusedCruxId = initialState.focusedCruxId;
          state.scrollToId = initialState.scrollToId;
          state.scrollToTimestamp = initialState.scrollToTimestamp;
          state.isMobileOutlineOpen = initialState.isMobileOutlineOpen;
        });
      },
    })),
    { name: "reportUIStore", enabled: DEVTOOLS_ENABLED },
  ),
);

// ============================================
// Selector Hooks
// These provide fine-grained reactivity.
// ============================================

export function useSortMode(): SortMode {
  return useReportUIStore((state) => state.sortMode);
}

export function useActiveContentTab(): ContentTab {
  return useReportUIStore((state) => state.activeContentTab);
}

export function useExpandedCruxId(): string | null {
  return useReportUIStore((state) => state.expandedCruxId);
}

export function useFocusedNodeId(): string | null {
  return useReportUIStore((state) => state.focusedNodeId);
}

export function useFocusedCruxId(): string | null {
  return useReportUIStore((state) => state.focusedCruxId);
}

export function useScrollToId(): string | null {
  return useReportUIStore((state) => state.scrollToId);
}

export function useScrollToTimestamp(): number {
  return useReportUIStore((state) => state.scrollToTimestamp);
}

export function useIsMobileOutlineOpen(): boolean {
  return useReportUIStore((state) => state.isMobileOutlineOpen);
}

/**
 * Derive sortByControversy boolean for backward compatibility.
 */
export function useSortByControversy(): boolean {
  return useReportUIStore((state) => state.sortMode === "controversy");
}

/**
 * Derive sortByBridging boolean for backward compatibility.
 */
export function useSortByBridging(): boolean {
  return useReportUIStore((state) => state.sortMode === "bridging");
}
