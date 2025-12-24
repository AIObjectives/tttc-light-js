"use client";

import { useEffect, useRef } from "react";
import {
  useReportUIStore,
  useScrollToId,
  useScrollToTimestamp,
} from "../reportUIStore";

/** Navbar height plus padding for scroll offset */
const NAVBAR_OFFSET = 80;

/**
 * Hook that handles scroll-to behavior when scrollToId changes.
 * Replaces the old useScrollTo/setScrollTo pattern from ReportContext.
 *
 * Uses the same scroll and highlight pattern as the legacy useScrollListener
 * for consistency. Elements must have an `id` attribute matching the scrollToId.
 *
 * Should be called once at the Report component level.
 *
 * @example
 * // In Report.tsx
 * useScrollEffect();
 *
 * // To trigger a scroll from anywhere:
 * const scrollTo = useReportUIStore((s) => s.scrollTo);
 * scrollTo("topic-123");
 */
export function useScrollEffect() {
  const scrollToId = useScrollToId();
  const scrollToTimestamp = useScrollToTimestamp();
  const clearScrollTo = useReportUIStore((state) => state.clearScrollTo);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollToTimestamp intentionally included - enables re-scrolling to same ID (timestamp changes on each scrollTo() call)
  useEffect(() => {
    if (!scrollToId) return;

    const element = document.getElementById(scrollToId);
    if (!element) {
      // Element not found, clear scroll target
      clearScrollTo();
      return;
    }

    // Scroll to position element near top of viewport (accounting for navbar)
    const y =
      element.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;
    window.scroll({
      top: y,
      behavior: "smooth",
    });

    // Add highlight pulse animation
    element.classList.add("scroll-target-highlight");

    // Remove highlight when animation ends (matches global.css animation)
    const handleAnimationEnd = () => {
      element.classList.remove("scroll-target-highlight");
      element.removeEventListener("animationend", handleAnimationEnd);
    };
    element.addEventListener("animationend", handleAnimationEnd);

    // Clear the scroll target after a delay to allow re-triggering
    clearTimeoutRef.current = setTimeout(() => {
      clearScrollTo();
    }, 500);

    return () => {
      // Cleanup on unmount or re-render
      element.removeEventListener("animationend", handleAnimationEnd);
      element.classList.remove("scroll-target-highlight");
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, [scrollToId, scrollToTimestamp, clearScrollTo]);
}
