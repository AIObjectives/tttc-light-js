"use client";

import { useRef, useLayoutEffect, useState, useEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ClaimNode } from "../report/hooks/useReportState";
import { VirtualClaimItem } from "./VirtualClaimItem";

const ESTIMATED_CLAIM_HEIGHT = 48; // px - adjust based on actual measurements

export function VirtualizedClaimsList({
  claims,
  pagination,
}: {
  claims: ClaimNode[];
  pagination: number;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Measure offset from top of document to this container
  // Recalculate when pagination changes (layout may have shifted)
  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      if (listRef.current) {
        const rect = listRef.current.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        setScrollMargin(rect.top + scrollTop);
      }
    };

    updateScrollMargin();

    // Also update after a short delay to catch layout shifts from other components
    const timeoutId = setTimeout(updateScrollMargin, 100);
    return () => clearTimeout(timeoutId);
  }, [pagination]);

  // Only virtualize claims up to pagination index
  const visibleClaims = claims.slice(0, pagination + 1);

  const virtualizer = useWindowVirtualizer({
    count: visibleClaims.length,
    estimateSize: () => ESTIMATED_CLAIM_HEIGHT,
    overscan: 5, // Render 5 extra items above/below viewport
    scrollMargin, // Account for container's offset from page top
  });

  return (
    <div
      ref={listRef}
      style={{
        height: virtualizer.getTotalSize(),
        position: "relative",
        width: "100%",
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const claim = visibleClaims[virtualRow.index];
        return (
          <VirtualClaimItem
            key={claim.id}
            claim={claim}
            index={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
            measureElement={virtualizer.measureElement}
          />
        );
      })}
    </div>
  );
}
