"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReportUIStore } from "../reportUIStore";

/**
 * Hook that tracks which node is currently in the viewport center.
 * Uses IntersectionObserver for efficient scroll-based tracking.
 *
 * Usage:
 *   const ref = useFocusTracking(nodeId);
 *   return <div ref={ref}>...</div>
 */
export function useFocusTracking(
  nodeId: string,
): React.RefObject<HTMLDivElement | null> {
  const setFocusedNodeId = useReportUIStore((state) => state.setFocusedNodeId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setFocusedNodeId(nodeId);
          }
        }
      },
      {
        root: null,
        // Focus when element is in the upper-middle portion of viewport
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [nodeId, setFocusedNodeId]);

  return ref;
}

/**
 * Hook that tracks which crux is currently in the viewport.
 * Separate from node tracking for cruxes tab.
 */
export function useCruxFocusTracking<T extends HTMLElement = HTMLDivElement>(
  cruxId: string,
): React.RefObject<T | null> {
  const setFocusedCruxId = useReportUIStore((state) => state.setFocusedCruxId);
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setFocusedCruxId(cruxId);
          }
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [cruxId, setFocusedCruxId]);

  return ref;
}

/**
 * Hook to temporarily suppress focus tracking.
 * Useful during programmatic navigation to prevent scroll-based
 * focus updates from overriding the intended navigation target.
 *
 * Returns a tuple of [suppressFn, isSuppressed] for use with
 * useFocusTrackingWithSuppression.
 *
 * @example
 * const [suppress, isSuppressed] = useSuppressFocusTracking();
 * const ref = useFocusTrackingWithSuppression(nodeId, isSuppressed);
 *
 * // When navigating programmatically:
 * suppress(); // Pauses tracking for 500ms (default)
 */
export function useSuppressFocusTracking(): [
  (durationMs?: number) => void,
  boolean,
] {
  const [isSuppressed, setIsSuppressed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suppress = useCallback((durationMs = 500) => {
    setIsSuppressed(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsSuppressed(false);
    }, durationMs);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [suppress, isSuppressed];
}

/**
 * Combined hook for focus tracking with suppression support.
 * Use this in components that need both tracking and suppression.
 */
export function useFocusTrackingWithSuppression(
  nodeId: string,
  isSuppressed: boolean,
): React.RefObject<HTMLDivElement | null> {
  const setFocusedNodeId = useReportUIStore((state) => state.setFocusedNodeId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || isSuppressed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isSuppressed) return;

        for (const entry of entries) {
          if (entry.isIntersecting) {
            setFocusedNodeId(nodeId);
          }
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [nodeId, setFocusedNodeId, isSuppressed]);

  return ref;
}
