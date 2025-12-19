"use client";

import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// SSR-safe useLayoutEffect
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Configuration constants
const MAX_LINES = 2;
const LINE_HEIGHT_FALLBACK_MULTIPLIER = 1.2;
const HEIGHT_TOLERANCE_PX = 4;
const MIN_TRUNCATION_CHARS = 10;

/**
 * Calculates the truncation point for text to fit within MAX_LINES.
 * Uses binary search with a hidden measurement element.
 */
function calculateTruncationPoint(
  p: HTMLParagraphElement,
  text: string,
): number | null {
  const style = getComputedStyle(p);
  const lineHeight =
    parseFloat(style.lineHeight) ||
    parseFloat(style.fontSize) * LINE_HEIGHT_FALLBACK_MULTIPLIER;
  const maxHeight = lineHeight * MAX_LINES + HEIGHT_TOLERANCE_PX;

  // Create a hidden element for measurement (don't modify the real DOM)
  const measureEl = document.createElement("span");
  measureEl.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    width: ${p.clientWidth}px;
    font: ${style.font};
    line-height: ${style.lineHeight};
    letter-spacing: ${style.letterSpacing};
  `;
  document.body.appendChild(measureEl);

  try {
    // Check if full text fits in MAX_LINES
    measureEl.textContent = text;
    if (measureEl.scrollHeight <= maxHeight) {
      return null;
    }

    // Binary search to find truncation point that fits "text... Show more"
    const buttonText = "\u00A0Show more"; // non-breaking space + button text
    let lo = 0;
    let hi = text.length;

    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      measureEl.textContent = text.slice(0, mid).trimEnd() + "..." + buttonText;

      if (measureEl.scrollHeight <= maxHeight) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    // Ensure we truncate at least MIN_TRUNCATION_CHARS to make it meaningful
    if (lo >= text.length - MIN_TRUNCATION_CHARS) {
      return null;
    }
    return lo;
  } finally {
    // Cleanup measurement element
    if (measureEl.parentNode) {
      measureEl.parentNode.removeChild(measureEl);
    }
  }
}

export function ExpandableText({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const [isOpen, setIsOpen] = useState(false);
  const [truncateAt, setTruncateAt] = useState<number | null>(null);
  const pRef = useRef<HTMLParagraphElement>(null);

  // Get text content from children
  const text = typeof children === "string" ? children : String(children ?? "");

  // Calculate truncation point and recalculate on resize
  useIsomorphicLayoutEffect(() => {
    if (!pRef.current || !text) {
      setTruncateAt(null);
      return;
    }

    const p = pRef.current;

    // Calculate initial truncation
    const recalculate = () => {
      setTruncateAt(calculateTruncationPoint(p, text));
    };
    recalculate();

    // Watch for container width changes
    const resizeObserver = new ResizeObserver(() => {
      recalculate();
    });
    resizeObserver.observe(p);

    return () => {
      resizeObserver.disconnect();
    };
  }, [text]);

  const needsTruncation = truncateAt !== null && truncateAt < text.length;
  const displayText =
    isOpen || !needsTruncation
      ? text
      : text.slice(0, truncateAt).trimEnd() + "...";

  const buttonClass =
    "text-muted-foreground cursor-pointer text-sm whitespace-nowrap";

  // When truncated (collapsed), use text-justify with ::after trick to push button to right edge
  // The ::after pseudo-element (w-full inline-block) forces justify to apply to the last line
  const truncatedClass =
    needsTruncation && !isOpen
      ? "text-justify after:content-[''] after:inline-block after:w-full"
      : "";

  return (
    <p
      ref={pRef}
      className={`${className || ""} ${truncatedClass}`.trim()}
      {...props}
    >
      {displayText}
      {needsTruncation && (
        <>
          {"\u00A0"}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={buttonClass}
            aria-expanded={isOpen}
          >
            {isOpen ? "Show less" : "Show more"}
          </button>
        </>
      )}
    </p>
  );
}
