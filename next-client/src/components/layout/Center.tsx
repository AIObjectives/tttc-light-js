import React from "react";

/**
 * Centers content both horizontally and vertically.
 *
 * Uses flexbox for reliable cross-browser centering (particularly Firefox).
 * Works with both inline content (text) and block-level elements (SVGs, divs).
 */
export function Center({ children }: React.PropsWithChildren) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      {children}
    </div>
  );
}
