"use client";
import type React from "react";

/**
 * ClaimItem wrapper that handles visibility and scroll targeting.
 * The `id` prop enables scroll targeting via useScrollEffect.
 */
export function ClaimItem({
  show,
  id,
  children,
}: React.PropsWithChildren<{ id: string; show: boolean }>) {
  if (!show) return null;
  return <div id={id}>{children}</div>;
}
