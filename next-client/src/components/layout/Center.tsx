import React from "react";

/**
 * Centers content both horizontally and vertically.
 *
 * Handles all centering concerns internally, including text alignment
 * for cross-browser compatibility (particularly Firefox). Consumers don't
 * need to add text-center to child elements.
 */
export function Center({ children }: React.PropsWithChildren) {
  return (
    <div className="w-full h-full content-center justify-items-center">
      <div className="text-center">{children}</div>
    </div>
  );
}
