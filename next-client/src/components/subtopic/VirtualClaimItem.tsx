"use client";

import React, { useContext, useCallback } from "react";
import { mergeRefs } from "react-merge-refs";
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
