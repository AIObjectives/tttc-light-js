"use client";

import type React from "react";
import { useCallback, useContext } from "react";
import { mergeRefs } from "react-merge-refs";
import { Claim } from "../claim";
import type { ClaimNode } from "../report/hooks/useReportState";
import { ReportContext } from "../report/Report";

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

  // Create a ref callback for measurement
  const measureRef = useCallback(
    (el: HTMLDivElement | null) => {
      measureElement(el);
    },
    [measureElement],
  );

  return (
    <div
      ref={mergeRefs([scrollRef, measureRef])}
      style={style}
      data-index={index}
    >
      <Claim claim={claim.data} />
    </div>
  );
}
