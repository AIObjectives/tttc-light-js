/**
 * API Schema Validation Tests
 *
 * Tests Zod schema validation for API request/response types.
 * These tests ensure schema definitions remain consistent with actual data structures.
 */

import { describe, expect, it } from "vitest";
import { userCapabilitiesResponse } from "../index";

describe("API Schema Validation", () => {
  describe("userCapabilitiesResponse", () => {
    it("should validate correct user capabilities response", () => {
      const validResponse = {
        csvSizeLimit: 153600,
        canViewElicitationTracking: false,
      };

      const result = userCapabilitiesResponse.safeParse(validResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.csvSizeLimit).toBe(153600);
        expect(result.data.canViewElicitationTracking).toBe(false);
      }
    });

    it("should validate response with large upload limit", () => {
      const validResponse = {
        csvSizeLimit: 2097152, // 2MB
        canViewElicitationTracking: false,
      };

      const result = userCapabilitiesResponse.safeParse(validResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.csvSizeLimit).toBe(2097152);
        expect(result.data.canViewElicitationTracking).toBe(false);
      }
    });

    it("should reject response missing csvSizeLimit", () => {
      const invalidResponse = {
        wrongField: "invalid",
      };

      const result = userCapabilitiesResponse.safeParse(invalidResponse);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have errors for both missing fields
        const paths = result.error.issues.map((issue) => issue.path[0]);
        expect(paths).toContain("csvSizeLimit");
        expect(paths).toContain("canViewElicitationTracking");
      }
    });

    it("should reject response with negative csvSizeLimit", () => {
      const invalidResponse = {
        csvSizeLimit: -1000,
      };

      const result = userCapabilitiesResponse.safeParse(invalidResponse);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["csvSizeLimit"]);
        // Zod 4 changed error message format
        expect(result.error.issues[0].message).toContain(">=0");
      }
    });

    it("should reject response with non-numeric csvSizeLimit", () => {
      const invalidResponse = {
        csvSizeLimit: "150KB",
      };

      const result = userCapabilitiesResponse.safeParse(invalidResponse);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe("invalid_type");
        expect(result.error.issues[0].expected).toBe("number");
      }
    });

    it("should accept zero as valid csvSizeLimit", () => {
      const validResponse = {
        csvSizeLimit: 0,
        canViewElicitationTracking: true,
      };

      const result = userCapabilitiesResponse.safeParse(validResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.csvSizeLimit).toBe(0);
        expect(result.data.canViewElicitationTracking).toBe(true);
      }
    });

    it("should strip unknown fields (non-strict parsing)", () => {
      const responseWithExtra = {
        csvSizeLimit: 153600,
        canViewElicitationTracking: false,
        extraField: "should be ignored",
      };

      const result = userCapabilitiesResponse.safeParse(responseWithExtra);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          csvSizeLimit: 153600,
          canViewElicitationTracking: false,
        });
        expect(result.data).not.toHaveProperty("extraField");
      }
    });

    it("should work with parse() and throw on invalid data", () => {
      const invalidResponse = {
        csvSizeLimit: "invalid",
      };

      expect(() => userCapabilitiesResponse.parse(invalidResponse)).toThrow();
    });

    it("should work with parse() and return data on valid input", () => {
      const validResponse = {
        csvSizeLimit: 153600,
        canViewElicitationTracking: true,
      };

      const result = userCapabilitiesResponse.parse(validResponse);

      expect(result.csvSizeLimit).toBe(153600);
      expect(result.canViewElicitationTracking).toBe(true);
    });

    it("should validate event organizer capabilities", () => {
      const eventOrganizerResponse = {
        csvSizeLimit: 153600,
        canViewElicitationTracking: true,
      };

      const result = userCapabilitiesResponse.safeParse(eventOrganizerResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canViewElicitationTracking).toBe(true);
      }
    });

    it("should reject response with invalid canViewElicitationTracking type", () => {
      const invalidResponse = {
        csvSizeLimit: 153600,
        canViewElicitationTracking: "yes",
      };

      const result = userCapabilitiesResponse.safeParse(invalidResponse);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual([
          "canViewElicitationTracking",
        ]);
        expect(result.error.issues[0].code).toBe("invalid_type");
        expect(result.error.issues[0].expected).toBe("boolean");
      }
    });
  });
});
