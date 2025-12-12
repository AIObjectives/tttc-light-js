import React from "react";

/**
 * Centers content both horizontally and vertically.
 *
 * Uses flexbox for reliable cross-browser centering. The inner container
 * uses flex-col with items-center to properly center SVG elements (like
 * spinners) on mobile Safari, which doesn't respond to text-align: center
 * for SVGs.
 */
export function Center({ children }: React.PropsWithChildren) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
      <div className="flex flex-col items-center text-center">{children}</div>
    </div>
  );
}
