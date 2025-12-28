"use client";
import type React from "react";
import type { TreeNode } from "@/stores/types";

/**
 * Wrapper component that enables scroll targeting via useScrollEffect.
 * The `id` attribute allows scrollTo(id) to find and scroll to this element.
 */
export function NodeWrapper({
  node,
  children,
  className,
}: React.PropsWithChildren<{ node: TreeNode; className?: string }>) {
  return (
    <div id={node.id} className={className}>
      {children}
    </div>
  );
}
