"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "@/lib/firebase/auth";
import { User } from "firebase/auth";
import { ensureUserDocumentOnClient } from "@/lib/firebase/ensureUserDocument";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  // Use a Map to track ongoing ensure operations for each user
  const ensuredUsersRef = useRef<Set<string>>(new Set());
  const ensurePromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  const previousUserRef = useRef<User | null>(null);

  useEffect(() => {
    let mounted = true;

    try {
      const unsubscribe = onAuthStateChanged(async (authUser: User | null) => {
        if (!mounted) return;

        console.debug("[user-hook-client] Auth state changed", {
          uid: authUser?.uid,
          email: authUser?.email,
          displayName: authUser?.displayName,
        });

        // Detect logout: previous user existed but current user is null
        if (previousUserRef.current && !authUser) {
          console.info("[user-hook-client] User logged out");
          // Clear ensured users when user logs out
          ensuredUsersRef.current = new Set();
          setIsWaitlisted(false);
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
              console.debug(
                "[user-hook-client] Ensuring user document for new user",
              );
              const uid = authUser.uid; // Store UID in a local variable to avoid race conditions
              ensurePromise = ensureUserDocumentOnClient(authUser)
                .then((result) => {
                  if (!mounted) return;
                  // Don't add to ensuredUsersRef so it will retry next time
                  if (result.tag === "success") {
                    console.info(
                      "[user-hook-client] User document ensured successfully",
                      { uid },
                    );
                    ensuredUsersRef.current.add(uid);
                    setIsWaitlisted(false);
                  } else if (result.tag === "waitlisted") {
                    console.info("[user-hook-client] User is waitlisted", {
                      uid,
                    });
                    setIsWaitlisted(true);
                    // Don't add to ensured users since they're waitlisted
                  } else {
                    console.error(
                      "[user-hook-client] Failed to ensure user document",
                      { error: result.error },
                    );
                  }
                })
                .catch((error) => {
                  if (!mounted) return;
                  console.error(
                    "[user-hook-client] Unexpected error in user document creation",
                    { error },
                  );
                })
                .finally(() => {
                  ensurePromisesRef.current.delete(uid);
                });
              ensurePromisesRef.current.set(uid, ensurePromise);
            }
            // Do not await ensurePromise; let it run in the background
          } else {
            console.debug("[user-hook-client] User document already ensured");
          }
        }
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.error("[user-hook-client] Failed to initialize auth", {
        error: err,
      });
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

  return {
    user,
    loading,
    error,
    isWaitlisted,
    emailVerified: user?.emailVerified ?? false,
  };
}
