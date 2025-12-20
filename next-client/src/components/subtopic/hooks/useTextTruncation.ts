import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Suppress useLayoutEffect warning in SSR
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Hook to detect if text content is truncated and needs a "Read more" button.
 * Measures the full height vs clamped height to determine truncation.
 *
 * @param text - The text content to measure (used as dependency for re-measurement)
 * @returns Object with ref, expansion state, and showReadMore flag
 */
export function useTextTruncation(text: string | undefined) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (!ref.current || !text) return;

    // Temporarily remove line-clamp to measure full height
    const element = ref.current;
    const originalClass = element.className;
    element.className = element.className.replace(/line-clamp-\d+/g, "");

    const fullHeight = element.scrollHeight;

    // Restore line-clamp
    element.className = originalClass;

    const clampedHeight = element.clientHeight;

    // Show button if content would be taller than clamped height
    setShowReadMore(fullHeight > clampedHeight);
  }, [text]);

  return { ref, isExpanded, setIsExpanded, showReadMore };
}
