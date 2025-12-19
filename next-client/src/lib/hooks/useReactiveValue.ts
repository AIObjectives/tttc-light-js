"use client";

import { useEffect, useState } from "react";

/**
 * Utility hook that combines useState and useEffect.
 * ! Warning: Not tested.
 */
export function useReactiveValue<T, _K>(
  fn: (...args: unknown[]) => T,
  deps: unknown[],
) {
  const [val, setVal] = useState<T>(fn());

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are dynamically passed by caller
  useEffect(() => {
    setVal(() => fn());
  }, deps);

  return val;
}
