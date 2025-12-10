"use client";

import React, { useContext, useCallback } from "react";
import { ReportContext } from "../report/Report";
import { Claim } from "../claim";
import { ClaimNode } from "../report/hooks/useReportState";

export function VirtualClaimItem({
  claim,
  index,
  style,
  measureElement,
}: {
  claim: ClaimNode;
  index: number;
  style: React.CSSProperties;
  measureElement: (node: Element | null | undefined) => void;
}) {
  const { useScrollTo } = useContext(ReportContext);
  const scrollRef = useScrollTo(claim.id);

  // Merge refs: one for scroll-to, one for size measurement
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      // Register with virtualizer for dynamic sizing
      measureElement(el);

      // Also set the scrollRef for scroll-to functionality
      if (scrollRef && typeof scrollRef === "object") {
        (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current =
          el;
      }
    },
    [measureElement, scrollRef],
  );

  return (
    <div ref={setRefs} style={style} data-index={index}>
      <Claim claim={claim.data} />
    </div>
  );
}
