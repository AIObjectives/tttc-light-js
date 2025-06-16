"use client";

import { useState, useEffect } from "react";

function getWindowDimensions() {
  if (!globalThis.window) return { width: 0, height: 0 };
  const { innerWidth: width, innerHeight: height } = window;
  return {
    width,
    height,
  };
}

/**
 * Returns window dimensions and listens for changes.
 */
export default function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(() =>
    getWindowDimensions(),
  );

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowDimensions;
}
