import { useState, useEffect } from "react";
export const useDeferredValue = <T>(value: T, delay = 1000): T | "deferred" => {
  const [deferredValue, setDeferredValue] = useState<T | "deferred">(
    "deferred",
  );

  useEffect(() => {
    // Set up the timer to check the value after the specified delay
    const timer = setTimeout(() => {
      setDeferredValue(value);
    }, delay);

    // Clean up the timer if the component unmounts or value changes
    return () => clearTimeout(timer);
  }, [value, delay]);

  return deferredValue;
};
