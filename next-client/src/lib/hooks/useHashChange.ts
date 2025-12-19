"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// ! This component isn't being currently used. Mark for deletion.

/**
 * Listens for url # changes
 */
export function useHashChange(format: "raw" | "decoded" = "decoded") {
  const [hash, setHash] = useState("");
  const _pathname = usePathname();
  const _searchParams = useSearchParams();

  const decode = (hash: string) => decodeURIComponent(hash.slice(1));

  const formatter: (str: string) => string =
    format === "decoded" ? decode : (str: string) => str;

  const handleHashChange = () => setHash(formatter(window.location.hash));

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
