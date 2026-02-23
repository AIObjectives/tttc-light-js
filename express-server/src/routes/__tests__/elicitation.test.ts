import type { Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createMinimalTestEnv } from "tttc-common/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestWithAuth } from "../../types/request";
import { getElicitationEvents } from "../elicitation";

// Mock Firebase module
vi.mock("../../Firebase", () => ({
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
      })),
      where: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
  },
  getCollectionName: vi.fn((name: string) => `${name.toLowerCase()}_test`),
}));

// Mock permissions module
vi.mock("tttc-common/permissions", () => ({
  isEventOrganizer: vi.fn((roles: string[]) =>
    roles.includes("event_organizer"),
  ),
}));

// Mock API schemas
vi.mock("tttc-common/api", () => ({
  elicitationEventsResponse: {
    parse: vi.fn((data) => data), // Pass through the data as-is
  },
}));

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock feature flags module
vi.mock("../../featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

// Mock create route to prevent transitive loading of server.ts
vi.mock("../create", () => ({
  createAndSaveReport: vi.fn(),
  createUserDocuments: vi.fn(),
  buildPipelineJob: vi.fn(),
  addAnonymousNames: vi.fn((data: { data: unknown[] }) => data),
  selectQueue: vi.fn(),
}));

// Mock error handler
vi.mock("../sendError", () => ({
  sendErrorByCode: vi.fn(),
}));

describe("getElicitationEvents", () => {
  let mockReq: RequestWithAuth;
  let mockRes: Response;
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexibility
  let mockFirebase: any;
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexibility
  let mockSendError: any;
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexibility
  let mockFeatureFlags: any;

  // Helper factories for test setup
  const createMockUser = (
    uid = "test-user-id",
    email = "test@example.com",
  ): DecodedIdToken =>
    ({
      uid,
      email,
    }) as DecodedIdToken;

  const createMockUserDoc = (roles: string[] = [], exists = true) => ({
    exists,
    data: () => ({ email: "test@example.com", roles }),
  });

  const createMockEventDoc = (
    id: string,
    eventName: string,
    ownerUserId: string,
    createdAt: Date,
    participantCount: number,
  ) => ({
    id,
    ref: {
      collection: vi.fn(() => ({
        count: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            data: () => ({ count: participantCount }),
          }),
        })),
      })),
    },
    data: () => ({
      event_name: eventName,
      owner_user_id: ownerUserId,
      created_at: {
        toDate: () => createdAt,
      },
    }),
  });

  const setupUserDocument = (roles: string[] = [], exists = true) => {
    const mockUserDoc = createMockUserDoc(roles, exists);
    const mockGet = vi.fn().mockResolvedValue(mockUserDoc);
    const mockDoc = vi.fn().mockReturnValue({ get: mockGet });
    const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
    mockFirebase.db.collection = mockCollection;
  };

  const setupEventsQuery = (
    events: ReturnType<typeof createMockEventDoc>[],
    userRoles: string[] = ["event_organizer"],
  ) => {
    const mockEventsGet = vi.fn().mockResolvedValue({ docs: events });
    const mockWhere = vi.fn().mockReturnValue({ get: mockEventsGet });
    const mockCollection = vi.fn((collectionName: string) => {
      if (collectionName === "users_test") {
        // Return user collection mock
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(createMockUserDoc(userRoles)),
          }),
        };
      }
      if (collectionName === "report_ref_test") {
        // Return empty linked reports for buildEventSummary
        return {
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [] }),
          }),
        };
      }
      // Return events collection mock
      return { where: mockWhere };
    });
    mockFirebase.db.collection = mockCollection;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks
    mockFirebase = vi.mocked(await import("../../Firebase.js"));
    mockSendError = vi.mocked(await import("../sendError.js"));
    mockFeatureFlags = vi.mocked(await import("../../featureFlags/index.js"));
    mockFeatureFlags.isFeatureEnabled.mockResolvedValue(true);

    // Create mock request with auth (middleware provides req.auth)
    mockReq = {
      auth: createMockUser(),
      context: { env: createMinimalTestEnv() },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as unknown as RequestWithAuth;

    // Create mock response
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;
  });

  describe("authorization", () => {
    it("should return 403 if elicitation feature flag is disabled", async () => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(false);

      await getElicitationEvents(mockReq, mockRes);

      expect(mockSendError.sendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "AUTH_UNAUTHORIZED",
        expect.anything(),
      );
    });

    it("should return 403 if user document not found", async () => {
      setupUserDocument([], false);

      await getElicitationEvents(mockReq, mockRes);

      expect(mockSendError.sendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "USER_NOT_FOUND",
        expect.anything(),
      );
    });

    it("should return 403 if user does not have event_organizer role", async () => {
      setupUserDocument(["basic_user"]);

      await getElicitationEvents(mockReq, mockRes);

      expect(mockSendError.sendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "AUTH_UNAUTHORIZED",
        expect.anything(),
      );
    });

    it("should allow users with event_organizer role", async () => {
      setupEventsQuery([]);

      await getElicitationEvents(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ events: [] });
    });
  });

  describe("event retrieval", () => {
    it("should return empty array when user has no events", async () => {
      setupEventsQuery([]);

      await getElicitationEvents(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ events: [] });
    });

    it("should return events with participant counts", async () => {
      const now = new Date();
      const events = [
        createMockEventDoc("event-1", "Test Event 1", "test-user-id", now, 5),
        createMockEventDoc("event-2", "Test Event 2", "test-user-id", now, 10),
      ];
      setupEventsQuery(events);

      await getElicitationEvents(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        events: [
          expect.objectContaining({
            id: "event-1",
            eventName: "Test Event 1",
            ownerUserId: "test-user-id",
            responderCount: 5,
            createdAt: now,
          }),
          expect.objectContaining({
            id: "event-2",
            eventName: "Test Event 2",
            ownerUserId: "test-user-id",
            responderCount: 10,
            createdAt: now,
          }),
        ],
      });
    });

    it("should sort events by createdAt (newest first)", async () => {
      const older = new Date("2024-01-01");
      const newer = new Date("2024-12-01");
      const events = [
        createMockEventDoc("event-old", "Old Event", "test-user-id", older, 3),
        createMockEventDoc("event-new", "New Event", "test-user-id", newer, 7),
      ];
      setupEventsQuery(events);

      await getElicitationEvents(mockReq, mockRes);

      const response = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(response.events[0].id).toBe("event-new");
      expect(response.events[1].id).toBe("event-old");
    });

    it("should query events by owner_user_id", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      });
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === "users_test") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi
                .fn()
                .mockResolvedValue(createMockUserDoc(["event_organizer"])),
            }),
          };
        }
        return { where: mockWhere };
      });
      mockFirebase.db.collection = mockCollection;

      await getElicitationEvents(mockReq, mockRes);

      expect(mockWhere).toHaveBeenCalledWith(
        "owner_user_id",
        "==",
        "test-user-id",
      );
    });

    it("should use dev collection name in development environment", async () => {
      const calls: string[] = [];
      const mockCollection = vi.fn((collectionName: string) => {
        calls.push(collectionName);
        if (collectionName === "users_test") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi
                .fn()
                .mockResolvedValue(createMockUserDoc(["event_organizer"])),
            }),
          };
        }
        return {
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [] }),
          }),
        };
      });
      mockFirebase.db.collection = mockCollection;

      await getElicitationEvents(mockReq, mockRes);

      expect(calls).toContain("elicitation_bot_events_dev");
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      const mockCollection = vi.fn(() => {
        throw new Error("Database connection failed");
      });
      mockFirebase.db.collection = mockCollection;

      await getElicitationEvents(mockReq, mockRes);

      expect(mockSendError.sendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "INTERNAL_ERROR",
        expect.anything(),
      );
    });
  });
});
