"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "@/lib/firebase/auth";
import { ensureUserDocumentOnClient } from "@/lib/firebase/ensureUserDocument";
import { queryKeys } from "./queryKeys";

/**
 * Auth state type matching the legacy useUser return value.
 * This interface is preserved for backward compatibility.
 */
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  emailVerified: boolean;
}

const INITIAL_STATE: AuthState = {
  user: null,
  loading: true,
  error: null,
  emailVerified: false,
};

const AUTH_INIT_TIMEOUT_MS = 5000;

// Module-level dedup tracking - survives React StrictMode remounts
// and is shared across all hook instances (preserved from legacy implementation)
const ensuredUsers = new Set<string>();
const pendingEnsures = new Map<string, Promise<void>>();

// Singleton subscription state
let unsubscribe: (() => void) | null = null;
let subscribedQueryClient: QueryClient | null = null;
let hasReceivedCallback = false;
let previousUserId: string | null = null;
let initTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the auth subscription and bridge to TanStack Query cache.
 * Should be called once when QueryProvider mounts.
 *
 * The subscription listens to Firebase onAuthStateChanged and pushes
 * auth state updates to the TanStack Query cache via setQueryData.
 */
export function initAuthSubscription(queryClient: QueryClient): void {
  // Prevent duplicate subscriptions
  if (subscribedQueryClient === queryClient) {
    return;
  }

  // Clean up previous subscription if switching clients
  if (unsubscribe) {
    cleanupAuthSubscription();
  }

  subscribedQueryClient = queryClient;
  hasReceivedCallback = false;

  // Set initial loading state
  queryClient.setQueryData<AuthState>(queryKeys.user.auth(), INITIAL_STATE);

  // Timeout fallback for slow Firebase SDK initialization
  initTimeoutId = setTimeout(() => {
    if (!hasReceivedCallback && subscribedQueryClient === queryClient) {
      console.debug("[auth-subscription] Auth init timeout - assuming no user");
      queryClient.setQueryData<AuthState>(queryKeys.user.auth(), {
        user: null,
        loading: false,
        error: null,
        emailVerified: false,
      });
    }
  }, AUTH_INIT_TIMEOUT_MS);

  try {
    unsubscribe = onAuthStateChanged(async (authUser: User | null) => {
      // Ignore callbacks after cleanup
      if (subscribedQueryClient !== queryClient) return;

      hasReceivedCallback = true;
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
        initTimeoutId = null;
      }

      console.debug("[auth-subscription] Auth state changed", {
        uid: authUser?.uid,
        email: authUser?.email,
      });

      // Detect logout: previous user existed but current user is null
      if (previousUserId && !authUser) {
        console.info("[auth-subscription] User logged out");
        // Clear ensured users when user logs out
        ensuredUsers.clear();

        // Invalidate user-dependent queries on logout
        queryClient.invalidateQueries({
          queryKey: queryKeys.user.capabilities(),
        });
      }

      previousUserId = authUser?.uid ?? null;

      // Update auth state in cache
      queryClient.setQueryData<AuthState>(queryKeys.user.auth(), {
        user: authUser,
        loading: false,
        error: null,
        emailVerified: authUser?.emailVerified ?? false,
      });

      // Ensure user document is created when user signs in (background, non-blocking)
      if (authUser && !ensuredUsers.has(authUser.uid)) {
        let ensurePromise = pendingEnsures.get(authUser.uid);
        if (!ensurePromise) {
          console.debug(
            "[auth-subscription] Ensuring user document for new user",
          );
          const uid = authUser.uid; // Store UID to avoid race conditions
          ensurePromise = ensureUserDocumentOnClient(authUser)
            .then((result) => {
              // Ignore if subscription was cleaned up
              if (subscribedQueryClient !== queryClient) return;

              if (result.tag === "success") {
                console.info(
                  "[auth-subscription] User document ensured successfully",
                  { uid },
                );
                ensuredUsers.add(uid);
              } else {
                console.error(
                  "[auth-subscription] Failed to ensure user document",
                  { error: result.error },
                );
              }
            })
            .catch((error) => {
              // Ignore if subscription was cleaned up
              if (subscribedQueryClient !== queryClient) return;

              console.error(
                "[auth-subscription] Unexpected error in user document creation",
                { error },
              );
            })
            .finally(() => {
              pendingEnsures.delete(uid);
            });
          pendingEnsures.set(uid, ensurePromise);
        }
        // Do not await ensurePromise; let it run in the background
      } else if (authUser) {
        console.debug("[auth-subscription] User document already ensured");
      }
    });
  } catch (err) {
    if (initTimeoutId) {
      clearTimeout(initTimeoutId);
      initTimeoutId = null;
    }
    console.error("[auth-subscription] Failed to initialize auth", {
      error: err,
    });

    queryClient.setQueryData<AuthState>(queryKeys.user.auth(), {
      user: null,
      loading: false,
      error: err instanceof Error ? err.message : "Auth initialization failed",
      emailVerified: false,
    });
  }
}

/**
 * Clean up the auth subscription.
 * Should be called when QueryProvider unmounts.
 */
export function cleanupAuthSubscription(): void {
  if (initTimeoutId) {
    clearTimeout(initTimeoutId);
    initTimeoutId = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  subscribedQueryClient = null;
  hasReceivedCallback = false;
  previousUserId = null;
}

/**
 * Get the initial auth state for use as a fallback.
 * Exported for use in useUserQuery hook.
 */
export function getInitialAuthState(): AuthState {
  return INITIAL_STATE;
}

// Export for testing purposes only
export const _testUtils = {
  resetState: () => {
    cleanupAuthSubscription();
    ensuredUsers.clear();
    pendingEnsures.clear();
  },
  getEnsuredUsers: () => ensuredUsers,
  getPendingEnsures: () => pendingEnsures,
};
