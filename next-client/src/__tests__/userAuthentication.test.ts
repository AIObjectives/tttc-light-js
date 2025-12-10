import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUser } from "../lib/hooks/getUser";
import { ensureUserDocumentOnClient } from "../lib/firebase/ensureUserDocument";
import { onAuthStateChanged } from "../lib/firebase/auth";
import { User } from "firebase/auth";

// Mock Firebase auth
vi.mock("../lib/firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  isGoogleRedirectPending: vi.fn().mockReturnValue(false),
  clearGoogleRedirectPending: vi.fn(),
  getGoogleRedirectReturnUrl: vi.fn().mockReturnValue(null),
}));

// Mock auth events
vi.mock("../lib/firebase/authEvents", () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock user document creation
vi.mock("../lib/firebase/ensureUserDocument", () => ({
  ensureUserDocumentOnClient: vi.fn(),
}));

// Mock logger
const { mockChildLogger } = vi.hoisted(() => ({
  mockChildLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("tttc-common/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => mockChildLogger),
  },
}));

describe("User Authentication Hook", () => {
  let mockOnAuthStateChanged: any;
  let mockEnsureUserDocument: any;
  let unsubscribeMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOnAuthStateChanged = vi.mocked(onAuthStateChanged);
    mockEnsureUserDocument = vi.mocked(ensureUserDocumentOnClient);
    unsubscribeMock = vi.fn();

    mockOnAuthStateChanged.mockReturnValue(unsubscribeMock);
    mockEnsureUserDocument.mockResolvedValue({
      tag: "success",
      uid: "test-user",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useUser hook", () => {
    it("should initialize with loading state", () => {
      // Arrange & Act
      const { result } = renderHook(() => useUser());

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

      let authCallback: (user: User | null) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return unsubscribeMock;
      });

      // Act
      const { result } = renderHook(() => useUser());

      // Simulate user sign in
      authCallback!(mockUser as User);

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

      let authCallback: (user: User | null) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return unsubscribeMock;
      });

      // Act
      const { result } = renderHook(() => useUser());

      // First sign in
      authCallback!(mockUser as User);
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Then sign out
      authCallback!(null);

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

      let authCallback: (user: User | null) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return unsubscribeMock;
      });

      // Act
      const { result } = renderHook(() => useUser());

      // Sign in same user twice
      authCallback!(mockUser as User);
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Wait for first document creation to complete
      await waitFor(() => {
        expect(mockEnsureUserDocument).toHaveBeenCalledTimes(1);
      });

      // Call auth callback again with same user
      authCallback!(mockUser as User);

      // Wait a bit to ensure any async operations complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert - should still only be called once
      expect(mockEnsureUserDocument).toHaveBeenCalledTimes(1);
    });

    it("should handle authentication errors gracefully", async () => {
      // Arrange
      const authError = new Error("Firebase auth failed");
      mockOnAuthStateChanged.mockImplementation(() => {
        throw authError;
      });

      // Act
      const { result } = renderHook(() => useUser());

      // Assert
      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe("Firebase auth failed");
      });
    });

    it("should clean up subscription on unmount", () => {
      // Arrange & Act
      const { unmount } = renderHook(() => useUser());
      unmount();

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

      let authCallback: (user: User | null) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return unsubscribeMock;
      });

      // Act
      const { result } = renderHook(() => useUser());
      authCallback!(mockUser as User);

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
  });
});
