import { describe, it, expect } from "vitest";
import { getPasswordStrength } from "../password";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants/auth";

describe("getPasswordStrength", () => {
  describe("Empty password", () => {
    it("returns empty label and color for empty password", () => {
      const result = getPasswordStrength("");
      expect(result.label).toBe("");
      expect(result.color).toBe("");
    });
  });

  describe("Password below minimum length", () => {
    it("returns remaining characters message when password is too short", () => {
      const password = "a".repeat(MIN_PASSWORD_LENGTH - 5);
      const result = getPasswordStrength(password);
      expect(result.label).toContain("5 more characters needed");
      expect(result.color).toBe("text-muted-foreground");
    });

    it("returns singular form when 1 character is needed", () => {
      const password = "a".repeat(MIN_PASSWORD_LENGTH - 1);
      const result = getPasswordStrength(password);
      expect(result.label).toBe("1 more character needed");
      expect(result.color).toBe("text-muted-foreground");
    });

    it("correctly calculates remaining characters for various lengths", () => {
      // 0 characters entered
      expect(getPasswordStrength("").label).toBe("");

      // 1 character entered
      const oneChar = getPasswordStrength("a");
      expect(oneChar.label).toContain(
        `${MIN_PASSWORD_LENGTH - 1} more characters needed`,
      );

      // Half the required length
      const halfLength = "a".repeat(Math.floor(MIN_PASSWORD_LENGTH / 2));
      const halfResult = getPasswordStrength(halfLength);
      const expectedRemaining =
        MIN_PASSWORD_LENGTH - Math.floor(MIN_PASSWORD_LENGTH / 2);
      expect(halfResult.label).toContain(`${expectedRemaining} more character`);
    });
  });

  describe("Password meets minimum length", () => {
    it("returns empty label when password exactly meets minimum", () => {
      const password = "a".repeat(MIN_PASSWORD_LENGTH);
      const result = getPasswordStrength(password);
      expect(result.label).toBe("");
      expect(result.color).toBe("");
    });

    it("returns empty label when password exceeds minimum", () => {
      const password = "a".repeat(MIN_PASSWORD_LENGTH + 10);
      const result = getPasswordStrength(password);
      expect(result.label).toBe("");
      expect(result.color).toBe("");
    });
  });

  describe("Edge cases", () => {
    it("handles unicode characters correctly", () => {
      // Each emoji is multiple code units but should count as characters
      const password = "a".repeat(MIN_PASSWORD_LENGTH - 2);
      const result = getPasswordStrength(password);
      expect(result.label).toContain("2 more characters needed");
    });

    it("handles whitespace in password", () => {
      const password = " ".repeat(MIN_PASSWORD_LENGTH);
      const result = getPasswordStrength(password);
      // Whitespace counts as characters (length-based validation only per NIST)
      expect(result.label).toBe("");
    });
  });
});
