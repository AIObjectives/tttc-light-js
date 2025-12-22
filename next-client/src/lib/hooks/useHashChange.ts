"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Listens for url # changes
 */
export function useHashChange(format: "raw" | "decoded" = "decoded") {
  const [hash, setHash] = useState("");
  const _pathname = usePathname();
  const _searchParams = useSearchParams();

  const handleHashChange = useCallback(() => {
    const rawHash = window.location.hash;
    const formatted =
      format === "decoded" ? decodeURIComponent(rawHash.slice(1)) : rawHash;
    setHash(formatted);
  }, [format]);

  useEffect(() => {
    // Set initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    // Clean up
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [handleHashChange]);

  return hash;
}
