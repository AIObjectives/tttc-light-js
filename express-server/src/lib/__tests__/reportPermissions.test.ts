/**
 * Unit tests for report permission logic
 *
 * Tests the access control rules for reports:
 * - Owner always has access (regardless of visibility)
 * - Explicitly public reports (isPublic === true) are accessible to anyone
 * - Legacy reports (isPublic === undefined) are grandfathered as public
 * - Explicitly private reports (isPublic === false) are only accessible to owner
 */

import type { ReportRef } from "tttc-common/firebase";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canModifyReport, checkReportAccess } from "../reportPermissions";

// Mock the logger to avoid noise in tests
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Helper to create a minimal ReportRef for testing
const createReportRef = (overrides: Partial<ReportRef> = {}): ReportRef => ({
  id: "test-report-id",
  userId: "owner-user-id",
  reportDataUri: "gs://bucket/report.json",
  title: "Test Report",
  description: "Test description",
  numTopics: 5,
  numSubtopics: 10,
  numClaims: 50,
  numPeople: 20,
  createdDate: new Date("2024-01-01"),
  ...overrides,
});

describe("checkReportAccess", () => {
  describe("owner access", () => {
    it("allows owner to access own private report", () => {
      const reportRef = createReportRef({ isPublic: false });
      const result = checkReportAccess(reportRef, "owner-user-id");

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("owner");
    });

    it("allows owner to access own public report", () => {
      const reportRef = createReportRef({ isPublic: true });
      const result = checkReportAccess(reportRef, "owner-user-id");

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("owner");
    });

    it("allows owner to access own legacy report", () => {
      const reportRef = createReportRef({ isPublic: undefined });
      const result = checkReportAccess(reportRef, "owner-user-id");

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("owner");
    });
  });

  describe("non-owner authenticated access", () => {
    it("denies non-owner access to private report", () => {
      const reportRef = createReportRef({ isPublic: false });
      const result = checkReportAccess(reportRef, "other-user-id");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("denied");
    });

    it("allows non-owner access to public report", () => {
      const reportRef = createReportRef({ isPublic: true });
      const result = checkReportAccess(reportRef, "other-user-id");

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("public");
    });

    it("allows non-owner access to legacy report (grandfathered as public)", () => {
      const reportRef = createReportRef({ isPublic: undefined });
      const result = checkReportAccess(reportRef, "other-user-id");

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("legacy");
    });
  });

  describe("unauthenticated access", () => {
    it("denies unauthenticated access to private report", () => {
      const reportRef = createReportRef({ isPublic: false });
      const result = checkReportAccess(reportRef, undefined);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("denied");
    });

    it("allows unauthenticated access to public report", () => {
      const reportRef = createReportRef({ isPublic: true });
      const result = checkReportAccess(reportRef, undefined);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("public");
    });

    it("allows unauthenticated access to legacy report (grandfathered as public)", () => {
      const reportRef = createReportRef({ isPublic: undefined });
      const result = checkReportAccess(reportRef, undefined);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("legacy");
    });
  });

  describe("edge cases", () => {
    it("treats empty string userId as unauthenticated", () => {
      const reportRef = createReportRef({ isPublic: false });
      // Empty string is falsy, should be treated as unauthenticated
      const result = checkReportAccess(reportRef, "");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("denied");
    });

    it("handles report with explicit false vs undefined isPublic differently", () => {
      const privateReport = createReportRef({ isPublic: false });
      const legacyReport = createReportRef({ isPublic: undefined });

      const privateResult = checkReportAccess(privateReport, "other-user");
      const legacyResult = checkReportAccess(legacyReport, "other-user");

      expect(privateResult.allowed).toBe(false);
      expect(privateResult.reason).toBe("denied");
      expect(legacyResult.allowed).toBe(true);
      expect(legacyResult.reason).toBe("legacy");
    });
  });
});

describe("canModifyReport", () => {
  describe("owner modification rights", () => {
    it("allows owner to modify their report", () => {
      const reportRef = createReportRef();
      const result = canModifyReport(reportRef, "owner-user-id");

      expect(result).toBe(true);
    });

    it("allows owner to modify private report", () => {
      const reportRef = createReportRef({ isPublic: false });
      const result = canModifyReport(reportRef, "owner-user-id");

      expect(result).toBe(true);
    });

    it("allows owner to modify public report", () => {
      const reportRef = createReportRef({ isPublic: true });
      const result = canModifyReport(reportRef, "owner-user-id");

      expect(result).toBe(true);
    });
  });

  describe("non-owner modification rights", () => {
    it("denies non-owner modification of report", () => {
      const reportRef = createReportRef();
      const result = canModifyReport(reportRef, "other-user-id");

      expect(result).toBe(false);
    });

    it("denies non-owner modification of public report", () => {
      // Even public reports can only be modified by owner
      const reportRef = createReportRef({ isPublic: true });
      const result = canModifyReport(reportRef, "other-user-id");

      expect(result).toBe(false);
    });
  });

  describe("unauthenticated modification rights", () => {
    it("denies unauthenticated modification", () => {
      const reportRef = createReportRef();
      const result = canModifyReport(reportRef, undefined);

      expect(result).toBe(false);
    });

    it("denies modification with empty string userId", () => {
      const reportRef = createReportRef();
      const result = canModifyReport(reportRef, "");

      expect(result).toBe(false);
    });
  });
});

describe("access control matrix", () => {
  // Comprehensive test covering all combinations from the plan
  const testCases = [
    // [isPublic, requestingUserId, expectedAllowed, expectedReason]
    // Owner scenarios
    {
      isPublic: false,
      requester: "owner-user-id",
      allowed: true,
      reason: "owner",
      desc: "owner + private",
    },
    {
      isPublic: true,
      requester: "owner-user-id",
      allowed: true,
      reason: "owner",
      desc: "owner + public",
    },
    {
      isPublic: undefined,
      requester: "owner-user-id",
      allowed: true,
      reason: "owner",
      desc: "owner + legacy",
    },
    // Non-owner scenarios
    {
      isPublic: false,
      requester: "other-user",
      allowed: false,
      reason: "denied",
      desc: "non-owner + private",
    },
    {
      isPublic: true,
      requester: "other-user",
      allowed: true,
      reason: "public",
      desc: "non-owner + public",
    },
    {
      isPublic: undefined,
      requester: "other-user",
      allowed: true,
      reason: "legacy",
      desc: "non-owner + legacy",
    },
    // Unauthenticated scenarios
    {
      isPublic: false,
      requester: undefined,
      allowed: false,
      reason: "denied",
      desc: "unauthenticated + private",
    },
    {
      isPublic: true,
      requester: undefined,
      allowed: true,
      reason: "public",
      desc: "unauthenticated + public",
    },
    {
      isPublic: undefined,
      requester: undefined,
      allowed: true,
      reason: "legacy",
      desc: "unauthenticated + legacy",
    },
  ] as const;

  it.each(
    testCases,
  )("$desc: isPublic=$isPublic, requester=$requester → allowed=$allowed, reason=$reason", ({
    isPublic,
    requester,
    allowed,
    reason,
  }) => {
    const reportRef = createReportRef({ isPublic });
    const result = checkReportAccess(reportRef, requester);

    expect(result.allowed).toBe(allowed);
    expect(result.reason).toBe(reason);
  });
});
