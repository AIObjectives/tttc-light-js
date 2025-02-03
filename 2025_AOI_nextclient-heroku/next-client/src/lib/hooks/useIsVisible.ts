"use client";

import { RefObject, useEffect, useRef, useState } from "react";

/**
 * Hook that triggers when component becomes visible on the screen.
 */
export function useIsVisible(): [RefObject<HTMLDivElement>, boolean] {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleIntersect = (entries: IntersectionObserverEntry[]) => {
    if (!containerRef.current) return;
    entries.forEach((entry) => {
      if (entry.isIntersecting) setIsVisible(true);
      else setIsVisible(false);
    });
  };

  useEffect(() => {
    const obs = new IntersectionObserver(handleIntersect);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => {
      if (containerRef.current) obs.unobserve(containerRef.current);
    };
  }, []);

  return [containerRef, isVisible];
}
