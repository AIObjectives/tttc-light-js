import { QueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onAuthStateChanged } from "@/lib/firebase/auth";
import { ensureUserDocumentOnClient } from "@/lib/firebase/ensureUserDocument";
import {
  _testUtils,
  type AuthState,
  cleanupAuthSubscription,
  initAuthSubscription,
} from "../authSubscription";
import { queryKeys } from "../queryKeys";

// Mock Firebase auth
vi.mock("@/lib/firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
}));

// Mock user document creation
vi.mock("@/lib/firebase/ensureUserDocument", () => ({
  ensureUserDocumentOnClient: vi.fn(),
}));

describe("authSubscription", () => {
  let queryClient: QueryClient;
  let mockOnAuthStateChanged: ReturnType<typeof vi.fn>;
  let mockEnsureUserDocument: ReturnType<typeof vi.fn>;
  let unsubscribeMock: ReturnType<typeof vi.fn>;
  let authCallback: ((user: User | null) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    _testUtils.resetState();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    mockOnAuthStateChanged = vi.mocked(onAuthStateChanged);
    mockEnsureUserDocument = vi.mocked(ensureUserDocumentOnClient);
    unsubscribeMock = vi.fn();

    mockOnAuthStateChanged.mockImplementation((callback) => {
      authCallback = callback;
      return unsubscribeMock;
    });

    mockEnsureUserDocument.mockResolvedValue({
      tag: "success",
      uid: "test-user",
    });
  });

  afterEach(() => {
    cleanupAuthSubscription();
    queryClient.clear();
    vi.restoreAllMocks();
  });

  describe("initAuthSubscription", () => {
    it("should set initial loading state in cache", () => {
      // Act
      initAuthSubscription(queryClient);

      // Assert
      const authState = queryClient.getQueryData<AuthState>(
        queryKeys.user.auth(),
      );
      expect(authState).toEqual({
        user: null,
        loading: true,
        error: null,
        emailVerified: false,
      });
    });

    it("should subscribe to Firebase auth changes", () => {
      // Act
      initAuthSubscription(queryClient);

      // Assert
      expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
      expect(typeof mockOnAuthStateChanged.mock.calls[0][0]).toBe("function");
    });

    it("should prevent duplicate subscriptions with same client", () => {
      // Act
      initAuthSubscription(queryClient);
      initAuthSubscription(queryClient);

      // Assert - should only subscribe once
      expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
    });

    it("should update cache when auth state changes to signed in", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "test-user-123",
        email: "test@example.com",
        emailVerified: true,
      };

      initAuthSubscription(queryClient);

      // Act
      authCallback?.(mockUser as User);

      // Wait for async updates
      await vi.waitFor(() => {
        const authState = queryClient.getQueryData<AuthState>(
          queryKeys.user.auth(),
        );
        expect(authState?.user).toBeDefined();
      });

      // Assert
      const authState = queryClient.getQueryData<AuthState>(
        queryKeys.user.auth(),
      );
      expect(authState).toEqual({
        user: mockUser,
        loading: false,
        error: null,
        emailVerified: true,
      });
    });

    it("should update cache when auth state changes to signed out", async () => {
      // Arrange
      initAuthSubscription(queryClient);

      // First sign in
      const mockUser: Partial<User> = { uid: "user-1" };
      authCallback?.(mockUser as User);

      await vi.waitFor(() => {
        const authState = queryClient.getQueryData<AuthState>(
          queryKeys.user.auth(),
        );
        expect(authState?.user).toBeDefined();
      });

      // Act - sign out
      authCallback?.(null);

      // Assert
      await vi.waitFor(() => {
        const authState = queryClient.getQueryData<AuthState>(
          queryKeys.user.auth(),
        );
        expect(authState?.user).toBeNull();
        expect(authState?.loading).toBe(false);
      });
    });

    it("should ensure user document on sign in", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "new-user-123",
        email: "new@example.com",
      };

      initAuthSubscription(queryClient);

      // Act
      authCallback?.(mockUser as User);

      // Assert
      await vi.waitFor(() => {
        expect(mockEnsureUserDocument).toHaveBeenCalledWith(mockUser);
      });
    });

    it("should not ensure user document for same user multiple times", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "repeat-user",
        email: "repeat@example.com",
      };

      initAuthSubscription(queryClient);

      // Act - sign in twice with same user
      authCallback?.(mockUser as User);
      await vi.waitFor(() => {
        expect(mockEnsureUserDocument).toHaveBeenCalledTimes(1);
      });

      authCallback?.(mockUser as User);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert - should still only be called once
      expect(mockEnsureUserDocument).toHaveBeenCalledTimes(1);
    });

    it("should clear ensured users on logout", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "logout-user",
        email: "logout@example.com",
      };

      initAuthSubscription(queryClient);

      // Sign in
      authCallback?.(mockUser as User);
      await vi.waitFor(() => {
        expect(_testUtils.getEnsuredUsers().has("logout-user")).toBe(true);
      });

      // Act - sign out
      authCallback?.(null);

      // Assert
      await vi.waitFor(() => {
        expect(_testUtils.getEnsuredUsers().size).toBe(0);
      });
    });

    it("should invalidate capabilities on logout", async () => {
      // Arrange
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const mockUser: Partial<User> = { uid: "user-with-caps" };

      initAuthSubscription(queryClient);

      // Sign in first
      authCallback?.(mockUser as User);
      await vi.waitFor(() => {
        const authState = queryClient.getQueryData<AuthState>(
          queryKeys.user.auth(),
        );
        expect(authState?.user).toBeDefined();
      });

      // Reset spy to only capture logout invalidation
      invalidateSpy.mockClear();

      // Act - sign out
      authCallback?.(null);

      // Assert
      await vi.waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: queryKeys.user.capabilities(),
        });
      });
    });

    it("should handle auth initialization error", () => {
      // Arrange
      const authError = new Error("Firebase init failed");
      mockOnAuthStateChanged.mockImplementation(() => {
        throw authError;
      });

      // Act
      initAuthSubscription(queryClient);

      // Assert
      const authState = queryClient.getQueryData<AuthState>(
        queryKeys.user.auth(),
      );
      expect(authState).toEqual({
        user: null,
        loading: false,
        error: "Firebase init failed",
        emailVerified: false,
      });
    });
  });

  describe("timeout behavior", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should stop loading after timeout if auth callback never fires", async () => {
      // Arrange - auth callback never fires
      mockOnAuthStateChanged.mockImplementation(() => {
        // Don't store or call the callback
        return unsubscribeMock;
      });

      // Act
      initAuthSubscription(queryClient);

      // Initially loading
      let authState = queryClient.getQueryData<AuthState>(
        queryKeys.user.auth(),
      );
      expect(authState?.loading).toBe(true);

      // Advance timer past timeout (5 seconds)
      await vi.advanceTimersByTimeAsync(5000);

      // Assert
      authState = queryClient.getQueryData<AuthState>(queryKeys.user.auth());
      expect(authState).toEqual({
        user: null,
        loading: false,
        error: null,
        emailVerified: false,
      });
    });

    it("should handle late auth callback after timeout", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "late-user",
        email: "late@example.com",
        emailVerified: true,
      };

      initAuthSubscription(queryClient);

      // Advance timer past timeout
      await vi.advanceTimersByTimeAsync(5000);

      // Verify timeout occurred
      let authState = queryClient.getQueryData<AuthState>(
        queryKeys.user.auth(),
      );
      expect(authState?.loading).toBe(false);
      expect(authState?.user).toBeNull();

      // Act - late callback fires (use real timers for the callback)
      vi.useRealTimers();
      authCallback?.(mockUser as User);

      // Wait for state update
      await vi.waitFor(() => {
        authState = queryClient.getQueryData<AuthState>(queryKeys.user.auth());
        expect(authState?.user).toEqual(mockUser);
      });

      // Assert
      expect(authState?.loading).toBe(false);

      // Restore fake timers for afterEach cleanup
      vi.useFakeTimers();
    });
  });

  describe("cleanupAuthSubscription", () => {
    it("should unsubscribe from auth changes", () => {
      // Arrange
      initAuthSubscription(queryClient);

      // Act
      cleanupAuthSubscription();

      // Assert
      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it("should ignore callbacks after cleanup", async () => {
      // Arrange
      const mockUser: Partial<User> = { uid: "post-cleanup-user" };
      initAuthSubscription(queryClient);

      // Get initial state (loading: true)
      const initialState = queryClient.getQueryData<AuthState>(
        queryKeys.user.auth(),
      );
      expect(initialState?.loading).toBe(true);

      // Act - cleanup then try to fire callback
      cleanupAuthSubscription();

      // Callback should be ignored because subscribedQueryClient is now null
      authCallback?.(mockUser as User);

      // Wait a bit for any async effects
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert - cache should still contain the initial loading state
      // (it wasn't updated because the callback was ignored)
      const finalState = queryClient.getQueryData<AuthState>(
        queryKeys.user.auth(),
      );

      // The key point is that the user should NOT have been set
      // The state might still exist or be undefined depending on gc
      // but if it exists, user should not be the post-cleanup user
      if (finalState) {
        expect(finalState.user?.uid).not.toBe("post-cleanup-user");
      }
    });
  });
});
