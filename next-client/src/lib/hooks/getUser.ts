"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "@/lib/firebase/auth";
import { User } from "firebase/auth";
import { ensureUserDocumentOnClient } from "@/lib/firebase/ensureUserDocument";
import { logger } from "tttc-common/logger";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Use a Map to track ongoing ensure operations for each user
  const ensuredUsersRef = useRef<Set<string>>(new Set());
  const ensurePromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  const previousUserRef = useRef<User | null>(null);

  useEffect(() => {
    let mounted = true;

    try {
      const unsubscribe = onAuthStateChanged(async (authUser: User | null) => {
        if (!mounted) return;

        logger.debug("Auth state changed", authUser);

        // Detect logout: previous user existed but current user is null
        if (previousUserRef.current && !authUser) {
          logger.info("User logged out");
          // Clear ensured users when user logs out
          ensuredUsersRef.current = new Set();
        }

        // Update the ref for next comparison
        previousUserRef.current = authUser;
        setUser(authUser);
        setLoading(false);
        setError(null);

        // Ensure user document is created when user signs in, avoiding race conditions
        if (authUser) {
          if (!ensuredUsersRef.current.has(authUser.uid)) {
            let ensurePromise = ensurePromisesRef.current.get(authUser.uid);
            if (!ensurePromise) {
              logger.debug("Ensuring user document for new user");
              const uid = authUser.uid; // Store UID in a local variable to avoid race conditions
              ensurePromise = ensureUserDocumentOnClient(authUser)
                .then(() => {
                  ensuredUsersRef.current.add(uid);
                })
                .catch((error) => {
                  logger.error("Failed to ensure user document", error);
                  // User state should still be updated even if document creation fails
                })
                .finally(() => {
                  ensurePromisesRef.current.delete(uid);
                });
              ensurePromisesRef.current.set(uid, ensurePromise);
            }
            // Do not await ensurePromise; let it run in the background
          } else {
            logger.debug("User document already ensured");
          }
        }
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } catch (err) {
      logger.error("Failed to initialize auth:", err);
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
