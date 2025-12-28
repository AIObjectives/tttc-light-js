"use client";

import type React from "react";
import { useCallback } from "react";
import type { ClaimNode } from "@/stores/types";
import { Claim } from "../claim";

/**
 * Virtualized claim item for long claim lists.
 * The `id` attribute enables scroll targeting via useScrollEffect.
 */
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
  // Create a ref callback for measurement
  const measureRef = useCallback(
    (el: HTMLDivElement | null) => {
      measureElement(el);
    },
    [measureElement],
  );

  return (
    <div ref={measureRef} id={claim.id} style={style} data-index={index}>
      <Claim claim={claim.data} />
    </div>
  );
}
