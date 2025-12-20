import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants/auth";
import { getFirebaseErrorMessage } from "../firebaseErrors";

describe("getFirebaseErrorMessage", () => {
  describe("Email enumeration prevention", () => {
    it("returns vague message for auth/email-already-in-use to prevent enumeration", () => {
      const message = getFirebaseErrorMessage("auth/email-already-in-use");
      // Should NOT directly confirm the email is registered
      // "if you already have an account" is acceptable - doesn't confirm existence
      expect(message).not.toContain("email is already");
      expect(message).not.toContain("email already exists");
      expect(message).not.toContain("registered");
      expect(message).toContain("Unable to create account");
    });

    it("returns identical message for auth/user-not-found, auth/wrong-password, and auth/invalid-credential", () => {
      const userNotFound = getFirebaseErrorMessage("auth/user-not-found");
      const wrongPassword = getFirebaseErrorMessage("auth/wrong-password");
      const invalidCredential = getFirebaseErrorMessage(
        "auth/invalid-credential",
      );

      // All should return same message to prevent email enumeration
      expect(userNotFound).toBe(wrongPassword);
      expect(wrongPassword).toBe(invalidCredential);
      expect(userNotFound).toBe("Invalid email or password.");
    });
  });

  describe("Sign up errors", () => {
    it("returns helpful message for invalid email", () => {
      const message = getFirebaseErrorMessage("auth/invalid-email");
      expect(message).toContain("valid email");
    });

    it("returns password length requirement for weak password", () => {
      const message = getFirebaseErrorMessage("auth/weak-password");
      expect(message).toContain(String(MIN_PASSWORD_LENGTH));
      expect(message).toContain("character");
    });

    it("returns contact support message for disabled sign-in method", () => {
      const message = getFirebaseErrorMessage("auth/operation-not-allowed");
      expect(message).toContain("not enabled");
      expect(message).toContain("contact support");
    });
  });

  describe("Rate limiting", () => {
    it("returns rate limit message for too many requests", () => {
      const message = getFirebaseErrorMessage("auth/too-many-requests");
      expect(message).toContain("Too many attempts");
      expect(message).toContain("try again later");
    });
  });

  describe("Network errors", () => {
    it("returns network error message", () => {
      const message = getFirebaseErrorMessage("auth/network-request-failed");
      expect(message).toContain("Network error");
      expect(message).toContain("connection");
    });
  });

  describe("Password reset errors", () => {
    it("returns expired message for expired action code", () => {
      const message = getFirebaseErrorMessage("auth/expired-action-code");
      expect(message).toContain("expired");
      expect(message).toContain("request a new");
    });

    it("returns invalid/used message for invalid action code", () => {
      const message = getFirebaseErrorMessage("auth/invalid-action-code");
      expect(message).toContain("invalid");
      expect(message).toContain("already been used");
    });
  });

  describe("Account status errors", () => {
    it("returns disabled account message", () => {
      const message = getFirebaseErrorMessage("auth/user-disabled");
      expect(message).toContain("disabled");
      expect(message).toContain("contact support");
    });
  });

  describe("Unknown errors", () => {
    it("returns generic message for unknown error codes", () => {
      const message = getFirebaseErrorMessage("auth/unknown-error-code");
      expect(message).toBe("An error occurred. Please try again.");
    });

    it("returns generic message for empty string", () => {
      const message = getFirebaseErrorMessage("");
      expect(message).toBe("An error occurred. Please try again.");
    });

    it("returns generic message for non-auth error codes", () => {
      const message = getFirebaseErrorMessage("firestore/permission-denied");
      expect(message).toBe("An error occurred. Please try again.");
    });
  });
});
