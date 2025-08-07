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

        logger.debug("CLIENT: Auth state changed", authUser);

        // Detect logout: previous user existed but current user is null
        if (previousUserRef.current && !authUser) {
          logger.info("CLIENT: User logged out");
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
              logger.debug(
                "CLIENT ENSURE: Ensuring user document for new user",
              );
              const uid = authUser.uid; // Store UID in a local variable to avoid race conditions
              ensurePromise = ensureUserDocumentOnClient(authUser)
                .then((result) => {
                  if (!mounted) return;

                  if (result.tag === "success") {
                    logger.info(
                      `CLIENT ENSURE: User document ensured successfully for ${uid}`,
                    );
                    ensuredUsersRef.current.add(uid);
                  } else {
                    logger.error(
                      "CLIENT ENSURE: Failed to ensure user document",
                      result.error,
                    );
                    // Don't add to ensuredUsersRef so it will retry next time
                  }
                })
                .catch((error) => {
                  if (!mounted) return;
                  logger.error(
                    "CLIENT ENSURE: Unexpected error in user document creation",
                    error,
                  );
                })
                .finally(() => {
                  ensurePromisesRef.current.delete(uid);
                });
              ensurePromisesRef.current.set(uid, ensurePromise);
            }
            // Do not await ensurePromise; let it run in the background
          } else {
            logger.debug("CLIENT ENSURE: User document already ensured");
          }
        }
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } catch (err) {
      logger.error("CLIENT: Failed to initialize auth:", err);
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
