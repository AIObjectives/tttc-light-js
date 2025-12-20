import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureUserDocument } from "../Firebase";

// Mock Firebase Admin SDK
vi.mock("firebase-admin", () => {
  const mockFirestore = {
    collection: vi.fn(),
  };

  const mockFieldValue = {
    serverTimestamp: vi.fn(() => ({ __type: "serverTimestamp" })),
  };

  const firestoreWithFieldValue = Object.assign(
    vi.fn(() => mockFirestore),
    { FieldValue: mockFieldValue },
  );

  return {
    default: {
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn(),
      },
      firestore: firestoreWithFieldValue,
      auth: vi.fn(() => ({
        verifyIdToken: vi.fn(),
      })),
    },
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    firestore: firestoreWithFieldValue,
    auth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
  };
});

// Mock the common Firebase utilities
vi.mock("tttc-common/firebase", () => ({
  useGetCollectionName: vi.fn(() => vi.fn((name: string) => `${name}_test`)),
  JOB_STATUS: {
    PENDING: "pending",
    FINISHED: "finished",
    FAILED: "failed",
  },
  SCHEMA_VERSIONS: {
    REPORT_REF: 1,
    REPORT_JOB: 1,
    USER_DOCUMENT: 1,
  },
}));

// Mock the logger
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

// Mock environment validation
vi.mock("../types/context", () => ({
  validateEnv: vi.fn(() => ({
    NODE_ENV: "development",
    FIREBASE_CREDENTIALS_ENCODED: Buffer.from(
      '{"type":"service_account","client_id":"test"}',
    ).toString("base64"),
  })),
}));

describe("User Account Handling", () => {
  let mockDoc: any;
  let mockUserRef: any;
  let mockFirestore: any;

  // Fixed timestamps for deterministic tests
  const FIXED_DATE = new Date("2023-01-01T00:00:00Z");

  // Define a proper interface for user document structure
  interface UserDoc {
    firebaseUid: string;
    email: string | null;
    displayName: string | null;
    isValid: boolean;
    isWaitlistApproved?: boolean; // Legacy field, no longer set for new users
    roles: string[];
    createdAt: { toDate: () => Date };
    lastLoginAt: { toDate: () => Date };
  }

  // Helper function to create mock user document responses
  const createMockUserDoc = (userData: Partial<UserDoc> = {}) => ({
    exists: true,
    data: () => ({
      firebaseUid: "default-uid",
      email: null,
      displayName: null,
      isValid: true,
      roles: ["user"],
      createdAt: { toDate: () => FIXED_DATE },
      lastLoginAt: { toDate: () => FIXED_DATE },
      ...userData,
    }),
  });

  const createMockNonExistentDoc = () => ({
    exists: false,
  });

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

      // Mock the first get() call (check if doc exists)
      mockUserRef.get.mockResolvedValueOnce(createMockNonExistentDoc());

      // Mock the second get() call (fetch updated document)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          firebaseUid: uid,
          email,
          displayName,
        }),
      );

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
        roles: ["user"],
        createdAt: expect.any(Object), // FieldValue.serverTimestamp()
        lastLoginAt: expect.any(Object), // FieldValue.serverTimestamp()
        schemaVersion: 1,
      });
      expect(mockChildLogger.debug).toHaveBeenCalledWith(
        {
          firebaseUid: uid,
          email,
          displayName,
          hasProfileData: false,
        },
        "ensureUserDocument called",
      );
    });

    it("should update existing user document with new login time", async () => {
      // Arrange
      const uid = "test-uid-456";
      const email = "existing@example.com";
      const displayName = "Existing User";

      // Mock the first get() call (check if doc exists)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          email: "existing@example.com",
          displayName: "Existing User",
        }),
      );

      // Mock the second get() call (fetch updated document)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          firebaseUid: uid,
          email: "existing@example.com",
          displayName: "Existing User",
        }),
      );

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

      // Mock the first get() call (check if doc exists)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          email: oldEmail,
          displayName,
        }),
      );

      // Mock the second get() call (fetch updated document)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          firebaseUid: uid,
          email: newEmail,
          displayName,
        }),
      );

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

      // Mock the first get() call (check if doc exists)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          email,
          displayName: oldDisplayName,
        }),
      );

      // Mock the second get() call (fetch updated document)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          firebaseUid: uid,
          email,
          displayName: newDisplayName,
        }),
      );

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

      // Mock the first get() call (check if doc exists)
      mockUserRef.get.mockResolvedValueOnce(createMockNonExistentDoc());

      // Mock the second get() call (fetch updated document)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          firebaseUid: uid,
          email: null,
          displayName: null,
        }),
      );

      // Act
      await ensureUserDocument(uid, null, null);

      // Assert
      expect(mockUserRef.set).toHaveBeenCalledWith({
        firebaseUid: uid,
        email: null,
        displayName: null,
        isValid: true,
        roles: ["user"],
        createdAt: expect.any(Object),
        lastLoginAt: expect.any(Object),
        schemaVersion: 1,
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

      expect(mockChildLogger.error).toHaveBeenCalledWith(
        { error },
        "Error ensuring user document",
      );
    });

    it("should use environment-specific collection names", async () => {
      // Arrange
      const uid = "test-uid-collection";

      // Mock the first get() call (check if doc exists)
      mockUserRef.get.mockResolvedValueOnce(createMockNonExistentDoc());

      // Mock the second get() call (fetch updated document)
      mockUserRef.get.mockResolvedValueOnce(
        createMockUserDoc({
          firebaseUid: uid,
          email: null,
          displayName: null,
        }),
      );

      // Act
      await ensureUserDocument(uid, null, null);

      // Assert
      expect(mockFirestore.collection).toHaveBeenCalledWith("USERS_test");
    });
  });
});
