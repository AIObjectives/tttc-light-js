import type { Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createMinimalTestEnv } from "tttc-common/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestWithAuth } from "../../types/request";
import { createElicitationEvent, getElicitationEvents } from "../elicitation";

// Mock Firebase module
vi.mock("../../Firebase", () => ({
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        id: "new-event-id",
      })),
      where: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
  },
  admin: {
    firestore: {
      Timestamp: {
        fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
      },
    },
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
    parse: vi.fn((data) => data),
  },
  createElicitationEventRequest: {
    parse: vi.fn((data) => data),
  },
  createElicitationEventResponse: {
    parse: vi.fn((data) => data),
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

describe("createElicitationEvent", () => {
  let mockReq: RequestWithAuth;
  let mockRes: Response;
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexibility
  let mockFirebase: any;
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexibility
  let mockSendError: any;
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexibility
  let mockFeatureFlags: any;

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

  const setupUserAndEventCreation = (roles: string[] = ["event_organizer"]) => {
    const now = new Date();
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockDocGet = vi.fn().mockResolvedValue({
      id: "new-event-id",
      ref: {
        collection: vi.fn(() => ({
          count: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
          })),
        })),
      },
      data: () => ({
        event_name: "Test Study",
        owner_user_id: "test-user-id",
        created_at: { toDate: () => now },
        mode: "survey",
      }),
    });
    const mockDocRef = {
      id: "new-event-id",
      set: mockSet,
      get: mockDocGet,
    };
    const mockCollection = vi.fn((collectionName: string) => {
      if (collectionName === "users_test") {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(createMockUserDoc(roles)),
          }),
        };
      }
      if (collectionName === "report_ref_test") {
        return {
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [] }),
          }),
        };
      }
      return { doc: vi.fn().mockReturnValue(mockDocRef) };
    });
    mockFirebase.db.collection = mockCollection;
    return { mockSet, mockDocGet };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockFirebase = vi.mocked(await import("../../Firebase.js"));
    mockSendError = vi.mocked(await import("../sendError.js"));
    mockFeatureFlags = vi.mocked(await import("../../featureFlags/index.js"));
    mockFeatureFlags.isFeatureEnabled.mockResolvedValue(true);

    mockReq = {
      auth: createMockUser(),
      context: { env: createMinimalTestEnv() },
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      body: { eventName: "Test Study", mode: "survey" },
    } as unknown as RequestWithAuth;

    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;
  });

  describe("authorization", () => {
    it("should return 403 if feature flag is disabled", async () => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(false);

      await createElicitationEvent(mockReq, mockRes);

      expect(mockSendError.sendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "AUTH_UNAUTHORIZED",
        expect.anything(),
      );
    });

    it("should return 404 if user document not found", async () => {
      const mockCollection = vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(createMockUserDoc([], false)),
        }),
      });
      mockFirebase.db.collection = mockCollection;

      await createElicitationEvent(mockReq, mockRes);

      expect(mockSendError.sendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "USER_NOT_FOUND",
        expect.anything(),
      );
    });

    it("should return 403 if user does not have event_organizer role", async () => {
      const mockCollection = vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(createMockUserDoc(["basic_user"])),
        }),
      });
      mockFirebase.db.collection = mockCollection;

      await createElicitationEvent(mockReq, mockRes);

      expect(mockSendError.sendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "AUTH_UNAUTHORIZED",
        expect.anything(),
      );
    });
  });

  describe("event creation", () => {
    it("should create event and return 201 with event data", async () => {
      setupUserAndEventCreation();

      await createElicitationEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            id: "new-event-id",
            eventName: "Test Study",
            mode: "survey",
            ownerUserId: "test-user-id",
            responderCount: 0,
          }),
        }),
      );
    });

    it("should write document with correct fields", async () => {
      const { mockSet } = setupUserAndEventCreation();
      mockReq.body = {
        eventName: "My Study",
        mode: "followup",
        description: "A description",
        mainQuestion: "What do you think?",
        expectedParticipantCount: 50,
      };

      await createElicitationEvent(mockReq, mockRes);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: "My Study",
          owner_user_id: "test-user-id",
          mode: "followup",
          description: "A description",
          main_question: "What do you think?",
          expected_participant_count: 50,
        }),
      );
    });

    it("should convert questions array to objects with id and asked_count", async () => {
      const { mockSet } = setupUserAndEventCreation();
      mockReq.body = {
        eventName: "My Study",
        mode: "survey",
        questions: ["Question 1", "Question 2"],
      };

      await createElicitationEvent(mockReq, mockRes);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          questions: [
            { id: 0, text: "Question 1", asked_count: 0 },
            { id: 1, text: "Question 2", asked_count: 0 },
          ],
        }),
      );
    });

    it("should store followUpQuestions with enabled: true", async () => {
      const { mockSet } = setupUserAndEventCreation();
      mockReq.body = {
        eventName: "My Study",
        mode: "followup",
        followUpQuestions: ["Follow up 1", "Follow up 2"],
      };

      await createElicitationEvent(mockReq, mockRes);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          follow_up_questions: {
            enabled: true,
            questions: ["Follow up 1", "Follow up 2"],
          },
        }),
      );
    });

    it("should use dev collection name in development", async () => {
      const calls: string[] = [];
      const now = new Date();
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
        if (collectionName === "report_ref_test") {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ docs: [] }),
            }),
          };
        }
        return {
          doc: vi.fn().mockReturnValue({
            id: "new-event-id",
            set: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue({
              id: "new-event-id",
              ref: {
                collection: vi.fn(() => ({
                  count: vi.fn(() => ({
                    get: vi
                      .fn()
                      .mockResolvedValue({ data: () => ({ count: 0 }) }),
                  })),
                })),
              },
              data: () => ({
                event_name: "Test Study",
                owner_user_id: "test-user-id",
                created_at: { toDate: () => now },
                mode: "survey",
              }),
            }),
          }),
        };
      });
      mockFirebase.db.collection = mockCollection;

      await createElicitationEvent(mockReq, mockRes);

      expect(calls).toContain("elicitation_bot_events_dev");
    });
  });
});
