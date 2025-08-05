import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ensureUserDocument } from "../Firebase";
import { logger } from "tttc-common/logger";

// Mock Firebase Admin SDK
vi.mock("firebase-admin", () => {
  const mockFirestore = {
    collection: vi.fn(),
  };

  const mockFieldValue = {
    serverTimestamp: vi.fn(() => ({ __type: "serverTimestamp" })),
  };

  return {
    default: {
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn(),
      },
      firestore: vi.fn(() => mockFirestore),
      auth: vi.fn(() => ({
        verifyIdToken: vi.fn(),
      })),
    },
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    firestore: Object.assign(
      vi.fn(() => mockFirestore),
      {
        FieldValue: mockFieldValue,
      },
    ),
    auth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
  };
});

// Mock the common Firebase utilities
vi.mock("tttc-common/firebase", () => ({
  useGetCollectionName: vi.fn(() => vi.fn((name: string) => `${name}_test`)),
}));

// Mock the logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock environment validation
vi.mock("../types/context", () => ({
  validateEnv: vi.fn(() => ({
    NODE_ENV: "test",
    FIREBASE_CREDENTIALS_ENCODED: Buffer.from(
      '{"type":"service_account","client_id":"test"}',
    ).toString("base64"),
  })),
}));

describe("User Account Handling", () => {
  let mockDoc: any;
  let mockUserRef: any;
  let mockFirestore: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked firebase-admin module
    const admin = await import("firebase-admin");
    mockFirestore = admin.firestore();

    // Setup Firestore mocks
    mockUserRef = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
    };

    mockDoc = vi.fn(() => mockUserRef);
    mockFirestore.collection.mockReturnValue({ doc: mockDoc });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ensureUserDocument", () => {
    it("should create a new user document when user does not exist", async () => {
      // Arrange
      const uid = "test-uid-123";
      const email = "test@example.com";
      const displayName = "Test User";

      mockUserRef.get.mockResolvedValue({
        exists: false,
      });

      // Act
      await ensureUserDocument(uid, email, displayName);

      // Assert
      expect(mockFirestore.collection).toHaveBeenCalledWith("USERS_test");
      expect(mockDoc).toHaveBeenCalledWith(uid);
      expect(mockUserRef.get).toHaveBeenCalled();
      expect(mockUserRef.set).toHaveBeenCalledWith({
        firebaseUid: uid,
        email,
        displayName,
        isValid: true,
        isWaitlistApproved: true,
        roles: ["user"],
        createdAt: expect.any(Object), // FieldValue.serverTimestamp()
        lastLoginAt: expect.any(Object), // FieldValue.serverTimestamp()
      });
      expect(logger.debug).toHaveBeenCalledWith("ensureUserDocument called", {
        firebaseUid: uid,
        email,
        displayName,
      });
    });

    it("should update existing user document with new login time", async () => {
      // Arrange
      const uid = "test-uid-456";
      const email = "existing@example.com";
      const displayName = "Existing User";

      mockUserRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: "existing@example.com",
          displayName: "Existing User",
        }),
      });

      // Act
      await ensureUserDocument(uid, email, displayName);

      // Assert
      expect(mockUserRef.get).toHaveBeenCalled();
      expect(mockUserRef.update).toHaveBeenCalledWith({
        lastLoginAt: expect.any(Object), // FieldValue.serverTimestamp()
      });
      expect(mockUserRef.set).not.toHaveBeenCalled();
    });

    it("should update user document when email changes", async () => {
      // Arrange
      const uid = "test-uid-789";
      const oldEmail = "old@example.com";
      const newEmail = "new@example.com";
      const displayName = "Test User";

      mockUserRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: oldEmail,
          displayName,
        }),
      });

      // Act
      await ensureUserDocument(uid, newEmail, displayName);

      // Assert
      expect(mockUserRef.update).toHaveBeenCalledWith({
        email: newEmail,
        lastLoginAt: expect.any(Object),
      });
    });

    it("should update user document when display name changes", async () => {
      // Arrange
      const uid = "test-uid-101";
      const email = "test@example.com";
      const oldDisplayName = "Old Name";
      const newDisplayName = "New Name";

      mockUserRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email,
          displayName: oldDisplayName,
        }),
      });

      // Act
      await ensureUserDocument(uid, email, newDisplayName);

      // Assert
      expect(mockUserRef.update).toHaveBeenCalledWith({
        displayName: newDisplayName,
        lastLoginAt: expect.any(Object),
      });
    });

    it("should handle null email and displayName gracefully", async () => {
      // Arrange
      const uid = "test-uid-null";

      mockUserRef.get.mockResolvedValue({
        exists: false,
      });

      // Act
      await ensureUserDocument(uid, null, null);

      // Assert
      expect(mockUserRef.set).toHaveBeenCalledWith({
        firebaseUid: uid,
        email: null,
        displayName: null,
        isValid: true,
        isWaitlistApproved: true,
        roles: ["user"],
        createdAt: expect.any(Object),
        lastLoginAt: expect.any(Object),
      });
    });

    it("should handle Firebase errors and log them", async () => {
      // Arrange
      const uid = "test-uid-error";
      const email = "error@example.com";
      const error = new Error("Firebase connection failed");

      mockUserRef.get.mockRejectedValue(error);

      // Act & Assert
      await expect(ensureUserDocument(uid, email, null)).rejects.toThrow(
        "Failed to ensure user document for test-uid-error: Firebase connection failed",
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Error ensuring user document",
        error,
      );
    });

    it("should use environment-specific collection names", async () => {
      // Arrange
      const uid = "test-uid-collection";

      mockUserRef.get.mockResolvedValue({ exists: false });

      // Act
      await ensureUserDocument(uid, null, null);

      // Assert
      expect(mockFirestore.collection).toHaveBeenCalledWith("USERS_test");
    });
  });
});
