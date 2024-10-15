"use client";

import { useRef, useCallback } from "react";

type ClickHandler = (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;

/**
 * React default behavior is to trigger both onClick and onDoubleClick when double-clicked. This wraps the callbacks and makes them exclusive.
 */
export function useXORClick(
  onClick: ClickHandler,
  onDoubleClick: ClickHandler,
  delay: number = 200,
): {
  handleClick: ClickHandler;
  handleDoubleClick: ClickHandler;
} {
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  // wraps onClick
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      if (clickTimer.current === null) {
        clickTimer.current = setTimeout(() => {
          onClick(event);
          clickTimer.current = null;
        }, delay);
      }
    },
    [onClick, delay],
  );

  // wraps onDoubleClick
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      if (clickTimer.current !== null) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
        onDoubleClick(event);
      }
    },
    [onDoubleClick],
  );

  return { handleClick, handleDoubleClick };
}
