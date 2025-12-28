import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onAuthStateChanged } from "../lib/firebase/auth";
import { ensureUserDocumentOnClient } from "../lib/firebase/ensureUserDocument";
import {
  _testUtils,
  cleanupAuthSubscription,
  initAuthSubscription,
} from "../lib/query/authSubscription";
import { useUserQuery } from "../lib/query/useUserQuery";

// Mock Firebase auth
vi.mock("../lib/firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
}));

// Mock user document creation
vi.mock("../lib/firebase/ensureUserDocument", () => ({
  ensureUserDocumentOnClient: vi.fn(),
}));

describe("User Authentication Hook", () => {
  let mockOnAuthStateChanged: ReturnType<typeof vi.fn>;
  let mockEnsureUserDocument: ReturnType<typeof vi.fn>;
  let unsubscribeMock: ReturnType<typeof vi.fn>;
  let authCallback: ((user: User | null) => void) | undefined;
  let queryClient: QueryClient;

  function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  }

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

    // Initialize auth subscription (simulates QueryProvider mounting)
    initAuthSubscription(queryClient);
  });

  afterEach(() => {
    cleanupAuthSubscription();
    queryClient.clear();
    vi.restoreAllMocks();
  });

  describe("useUserQuery hook", () => {
    it("should initialize with loading state", () => {
      // Arrange & Act
      const { result } = renderHook(() => useUserQuery(), {
        wrapper: createWrapper(),
      });

      // Assert
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should handle user sign in and create user document", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "test-user-123",
        email: "test@example.com",
        displayName: "Test User",
      };

      // Act
      const { result } = renderHook(() => useUserQuery(), {
        wrapper: createWrapper(),
      });

      // Simulate user sign in
      authCallback?.(mockUser as User);

      // Assert
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(mockEnsureUserDocument).toHaveBeenCalledWith(mockUser);
    });

    it("should handle user sign out and detect logout", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "test-user-456",
        email: "test@example.com",
      };

      // Act
      const { result } = renderHook(() => useUserQuery(), {
        wrapper: createWrapper(),
      });

      // First sign in
      authCallback?.(mockUser as User);
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Then sign out
      authCallback?.(null);

      // Assert
      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });

    it("should not create user document for same user multiple times", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "test-user-789",
        email: "test@example.com",
      };

      // Act
      const { result } = renderHook(() => useUserQuery(), {
        wrapper: createWrapper(),
      });

      // Sign in same user twice
      authCallback?.(mockUser as User);
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Wait for first document creation to complete
      await waitFor(() => {
        expect(mockEnsureUserDocument).toHaveBeenCalledTimes(1);
      });

      // Call auth callback again with same user
      authCallback?.(mockUser as User);

      // Wait a bit to ensure any async operations complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert - should still only be called once
      expect(mockEnsureUserDocument).toHaveBeenCalledTimes(1);
    });

    it("should handle authentication errors gracefully", async () => {
      // Arrange - reset and reinitialize with error
      cleanupAuthSubscription();
      _testUtils.resetState();

      const authError = new Error("Firebase auth failed");
      mockOnAuthStateChanged.mockImplementation(() => {
        throw authError;
      });

      // Act
      initAuthSubscription(queryClient);
      const { result } = renderHook(() => useUserQuery(), {
        wrapper: createWrapper(),
      });

      // Assert
      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe("Firebase auth failed");
      });
    });

    it("should clean up subscription on provider unmount", () => {
      // Arrange
      renderHook(() => useUserQuery(), {
        wrapper: createWrapper(),
      });

      // Act - cleanup subscription (simulates provider unmount)
      cleanupAuthSubscription();

      // Assert
      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it("should handle user document creation errors gracefully", async () => {
      // Arrange
      const mockUser: Partial<User> = {
        uid: "test-user-error",
        email: "error@example.com",
      };

      mockEnsureUserDocument.mockResolvedValue({
        tag: "failure",
        error: new Error("Document creation failed"),
        retryable: false,
      });

      // Act
      const { result } = renderHook(() => useUserQuery(), {
        wrapper: createWrapper(),
      });
      authCallback?.(mockUser as User);

      // Assert - User should still be set even if document creation fails
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(mockEnsureUserDocument).toHaveBeenCalledWith(mockUser);

      // Wait for the promise rejection to be handled
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Note: Timeout behavior is tested in authSubscription.test.ts at the cache level.
    // The useUser hook is a thin wrapper that reads from React Query cache,
    // so timeout scenarios are best tested at the subscription manager level.
  });
});
