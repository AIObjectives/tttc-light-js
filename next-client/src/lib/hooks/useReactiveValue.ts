"use client";

import { useEffect, useState } from "react";

/**
 * Utility hook that combines useState and useEffect.
 * ! Warning: Not tested.
 */
export function useReactiveValue<T, K>(
  fn: (...args: unknown[]) => T,
  deps: unknown[],
) {
  const [val, setVal] = useState<T>(fn());

  useEffect(() => {
    setVal(() => fn());
  }, deps);

  return val;
}
