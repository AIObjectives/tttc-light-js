"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function useHashChange(format: "raw" | "decoded" = "decoded") {
  const [hash, setHash] = useState("");
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
  }, [pathname, searchParams]);

  return hash;
}
