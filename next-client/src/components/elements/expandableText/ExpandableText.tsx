"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";

// SSR-safe useLayoutEffect
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function ExpandableText({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const [isOpen, setIsOpen] = useState(false);
  const [truncateAt, setTruncateAt] = useState<number | null>(null);
  const pRef = useRef<HTMLParagraphElement>(null);

  // Get text content from children
  const text = typeof children === "string" ? children : String(children ?? "");

  // Calculate truncation point using binary search with a hidden measurement element
  // This avoids interfering with React's DOM management
  useIsomorphicLayoutEffect(() => {
    if (!pRef.current || !text) {
      setTruncateAt(null);
      return;
    }

    const p = pRef.current;
    const style = getComputedStyle(p);
    const lineHeight =
      parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const maxHeight = lineHeight * 2 + 4; // 2 lines with small tolerance

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

    // Check if full text fits in 2 lines
    measureEl.textContent = text;
    if (measureEl.scrollHeight <= maxHeight) {
      document.body.removeChild(measureEl);
      setTruncateAt(null);
      return;
    }

    // Binary search to find truncation point that fits "text... Show more" in 2 lines
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

    document.body.removeChild(measureEl);

    // Ensure we truncate at least 10 characters to make it meaningful
    if (lo >= text.length - 10) {
      setTruncateAt(null);
    } else {
      setTruncateAt(lo);
    }
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
