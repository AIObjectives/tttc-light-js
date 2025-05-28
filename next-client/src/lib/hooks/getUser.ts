"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "@/lib/firebase/auth";
import { User } from "firebase/auth";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    try {
      const unsubscribe = onAuthStateChanged((authUser: User | null) => {
        if (!mounted) return;

        setUser(authUser);
        setLoading(false);
        setError(null);
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.error("Failed to initialize auth:", err);
      if (mounted) {
        setError(
          err instanceof Error ? err.message : "Auth initialization failed",
        );
        setLoading(false);
      }
      return () => {
        mounted = false;
      };
    }
  }, []);

  return { user, loading, error };
}
