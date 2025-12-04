import React from "react";

/**
 * Centers content both horizontally and vertically.
 *
 * Handles all centering concerns internally, including text alignment
 * for cross-browser compatibility (particularly Firefox). Uses flexbox
 * with min-height for reliable centering even when parent height context
 * is not explicitly set.
 */
export function Center({ children }: React.PropsWithChildren) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
      <div className="text-center">{children}</div>
    </div>
  );
}
