import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useReportUIStore } from "../reportUIStore";

describe("reportUIStore", () => {
  // Reset store between tests
  beforeEach(() => {
    useReportUIStore.getState().reset();
  });

  afterEach(() => {
    useReportUIStore.getState().reset();
  });

  describe("initial state", () => {
    it("should have correct default values", () => {
      const state = useReportUIStore.getState();

      expect(state.sortMode).toBe("frequent");
      expect(state.activeContentTab).toBe("report");
      expect(state.expandedCruxId).toBeNull();
      expect(state.focusedNodeId).toBeNull();
      expect(state.focusedCruxId).toBeNull();
      expect(state.scrollToId).toBeNull();
      expect(state.scrollToTimestamp).toBe(0);
      expect(state.isMobileOutlineOpen).toBe(false);
    });
  });

  describe("sort mode", () => {
    it("should set sort mode to controversy", () => {
      const { setSortMode } = useReportUIStore.getState();

      setSortMode("controversy");

      expect(useReportUIStore.getState().sortMode).toBe("controversy");
    });

    it("should set sort mode to bridging", () => {
      const { setSortMode } = useReportUIStore.getState();

      setSortMode("bridging");

      expect(useReportUIStore.getState().sortMode).toBe("bridging");
    });

    it("should set sort mode back to frequent", () => {
      const { setSortMode } = useReportUIStore.getState();

      setSortMode("controversy");
      setSortMode("frequent");

      expect(useReportUIStore.getState().sortMode).toBe("frequent");
    });
  });

  describe("content tab navigation", () => {
    it("should set active content tab to cruxes", () => {
      const { setActiveContentTab } = useReportUIStore.getState();

      setActiveContentTab("cruxes");

      expect(useReportUIStore.getState().activeContentTab).toBe("cruxes");
    });

    it("should set active content tab back to report", () => {
      const { setActiveContentTab } = useReportUIStore.getState();

      setActiveContentTab("cruxes");
      setActiveContentTab("report");

      expect(useReportUIStore.getState().activeContentTab).toBe("report");
    });
  });

  describe("expanded crux", () => {
    it("should set expanded crux id", () => {
      const { setExpandedCruxId } = useReportUIStore.getState();

      setExpandedCruxId("crux-123");

      expect(useReportUIStore.getState().expandedCruxId).toBe("crux-123");
    });

    it("should clear expanded crux id", () => {
      const { setExpandedCruxId } = useReportUIStore.getState();

      setExpandedCruxId("crux-123");
      setExpandedCruxId(null);

      expect(useReportUIStore.getState().expandedCruxId).toBeNull();
    });
  });

  describe("focus tracking", () => {
    it("should set focused node id", () => {
      const { setFocusedNodeId } = useReportUIStore.getState();

      setFocusedNodeId("topic-1");

      expect(useReportUIStore.getState().focusedNodeId).toBe("topic-1");
    });

    it("should set focused crux id", () => {
      const { setFocusedCruxId } = useReportUIStore.getState();

      setFocusedCruxId("crux-456");

      expect(useReportUIStore.getState().focusedCruxId).toBe("crux-456");
    });

    it("should clear focused node id", () => {
      const { setFocusedNodeId } = useReportUIStore.getState();

      setFocusedNodeId("topic-1");
      setFocusedNodeId(null);

      expect(useReportUIStore.getState().focusedNodeId).toBeNull();
    });
  });

  describe("scroll management", () => {
    it("should set scroll target with timestamp", () => {
      const { scrollTo } = useReportUIStore.getState();

      scrollTo("element-123");

      const state = useReportUIStore.getState();
      expect(state.scrollToId).toBe("element-123");
      expect(state.scrollToTimestamp).toBeGreaterThan(0);
    });

    it("should update timestamp on subsequent scrollTo calls", async () => {
      const { scrollTo } = useReportUIStore.getState();

      scrollTo("element-1");
      const firstTimestamp = useReportUIStore.getState().scrollToTimestamp;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      scrollTo("element-2");
      const secondTimestamp = useReportUIStore.getState().scrollToTimestamp;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
    });

    it("should allow re-scrolling to same element with new timestamp", async () => {
      const { scrollTo } = useReportUIStore.getState();

      scrollTo("same-element");
      const firstTimestamp = useReportUIStore.getState().scrollToTimestamp;

      await new Promise((resolve) => setTimeout(resolve, 10));

      scrollTo("same-element");
      const secondTimestamp = useReportUIStore.getState().scrollToTimestamp;

      expect(useReportUIStore.getState().scrollToId).toBe("same-element");
      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
    });

    it("should clear scroll target", () => {
      const { scrollTo, clearScrollTo } = useReportUIStore.getState();

      scrollTo("element-123");
      expect(useReportUIStore.getState().scrollToId).toBe("element-123");

      clearScrollTo();
      expect(useReportUIStore.getState().scrollToId).toBeNull();
    });
  });

  describe("mobile outline", () => {
    it("should set mobile outline open", () => {
      const { setMobileOutlineOpen } = useReportUIStore.getState();

      setMobileOutlineOpen(true);

      expect(useReportUIStore.getState().isMobileOutlineOpen).toBe(true);
    });

    it("should set mobile outline closed", () => {
      const { setMobileOutlineOpen } = useReportUIStore.getState();

      setMobileOutlineOpen(true);
      setMobileOutlineOpen(false);

      expect(useReportUIStore.getState().isMobileOutlineOpen).toBe(false);
    });

    it("should toggle mobile outline", () => {
      const { toggleMobileOutline } = useReportUIStore.getState();

      expect(useReportUIStore.getState().isMobileOutlineOpen).toBe(false);

      toggleMobileOutline();
      expect(useReportUIStore.getState().isMobileOutlineOpen).toBe(true);

      toggleMobileOutline();
      expect(useReportUIStore.getState().isMobileOutlineOpen).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset all state to defaults", () => {
      const store = useReportUIStore.getState();

      // Set various state
      store.setSortMode("controversy");
      store.setActiveContentTab("cruxes");
      store.setExpandedCruxId("crux-1");
      store.setFocusedNodeId("node-1");
      store.setFocusedCruxId("crux-2");
      store.scrollTo("element-1");
      store.setMobileOutlineOpen(true);

      // Reset
      store.reset();

      // Verify all reset
      const state = useReportUIStore.getState();
      expect(state.sortMode).toBe("frequent");
      expect(state.activeContentTab).toBe("report");
      expect(state.expandedCruxId).toBeNull();
      expect(state.focusedNodeId).toBeNull();
      expect(state.focusedCruxId).toBeNull();
      expect(state.scrollToId).toBeNull();
      expect(state.scrollToTimestamp).toBe(0);
      expect(state.isMobileOutlineOpen).toBe(false);
    });
  });
});
