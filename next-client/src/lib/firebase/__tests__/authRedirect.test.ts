import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Firebase auth before importing the module under test
vi.mock("firebase/auth", () => ({
  signInWithRedirect: vi.fn(),
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({
    addScope: vi.fn(),
  })),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  setPersistence: vi.fn().mockResolvedValue(undefined),
  browserLocalPersistence: {},
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("../clientApp", () => ({
  getFirebaseAuth: vi.fn().mockReturnValue({}),
}));

// Import after mocking
import {
  setGoogleRedirectPending,
  isGoogleRedirectPending,
  clearGoogleRedirectPending,
  getGoogleRedirectReturnUrl,
} from "../auth";

describe("Google Redirect Flag Helpers", () => {
  const STORAGE_KEY = "google_signin_redirect_pending";

  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    // Reset Date.now mock if needed
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("setGoogleRedirectPending", () => {
    it("sets the redirect pending flag in sessionStorage", () => {
      setGoogleRedirectPending();
      const stored = sessionStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const data = JSON.parse(stored!);
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe("number");
    });

    it("stores the return URL when provided", () => {
      setGoogleRedirectPending("/create");
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const data = JSON.parse(stored!);
      expect(data.returnUrl).toBe("/create");
    });

    it("uses current pathname as default return URL", () => {
      // window.location.pathname defaults to "/" in jsdom
      setGoogleRedirectPending();
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const data = JSON.parse(stored!);
      expect(data.returnUrl).toBe("/");
    });

    it("handles sessionStorage errors gracefully", () => {
      // Mock sessionStorage.setItem to throw
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      // Should not throw
      expect(() => setGoogleRedirectPending()).not.toThrow();

      // Restore
      sessionStorage.setItem = originalSetItem;
    });
  });

  describe("isGoogleRedirectPending", () => {
    it("returns false when no flag is set", () => {
      expect(isGoogleRedirectPending()).toBe(false);
    });

    it("returns true when flag is recently set", () => {
      setGoogleRedirectPending();
      expect(isGoogleRedirectPending()).toBe(true);
    });

    it("returns false when flag is expired (5+ minutes old)", () => {
      // Set the flag with a timestamp from 6 minutes ago
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      const data = { timestamp: sixMinutesAgo, returnUrl: "/" };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      expect(isGoogleRedirectPending()).toBe(false);
    });

    it("clears expired flag from storage", () => {
      // Set the flag with a timestamp from 6 minutes ago
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      const data = { timestamp: sixMinutesAgo, returnUrl: "/" };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      isGoogleRedirectPending();

      // Flag should be cleared
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("returns false for invalid JSON data", () => {
      sessionStorage.setItem(STORAGE_KEY, "not-valid-json");
      expect(isGoogleRedirectPending()).toBe(false);
    });

    it("handles sessionStorage errors gracefully", () => {
      const originalGetItem = sessionStorage.getItem;
      sessionStorage.getItem = vi.fn().mockImplementation(() => {
        throw new Error("SecurityError");
      });

      expect(isGoogleRedirectPending()).toBe(false);

      sessionStorage.getItem = originalGetItem;
    });
  });

  describe("clearGoogleRedirectPending", () => {
    it("removes the flag from sessionStorage", () => {
      setGoogleRedirectPending();
      expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

      clearGoogleRedirectPending();
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("handles sessionStorage errors gracefully", () => {
      const originalRemoveItem = sessionStorage.removeItem;
      sessionStorage.removeItem = vi.fn().mockImplementation(() => {
        throw new Error("SecurityError");
      });

      // Should not throw
      expect(() => clearGoogleRedirectPending()).not.toThrow();

      sessionStorage.removeItem = originalRemoveItem;
    });
  });

  describe("getGoogleRedirectReturnUrl", () => {
    it("returns null when no flag is set", () => {
      expect(getGoogleRedirectReturnUrl()).toBeNull();
    });

    it("returns the stored return URL", () => {
      setGoogleRedirectPending("/create");
      expect(getGoogleRedirectReturnUrl()).toBe("/create");
    });

    it("returns null when flag is expired", () => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      const data = { timestamp: sixMinutesAgo, returnUrl: "/create" };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      expect(getGoogleRedirectReturnUrl()).toBeNull();
    });

    it("returns null for invalid JSON data", () => {
      sessionStorage.setItem(STORAGE_KEY, "not-valid-json");
      expect(getGoogleRedirectReturnUrl()).toBeNull();
    });

    it("returns null when returnUrl is not set", () => {
      const data = { timestamp: Date.now() };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      expect(getGoogleRedirectReturnUrl()).toBeNull();
    });

    it("handles sessionStorage errors gracefully", () => {
      const originalGetItem = sessionStorage.getItem;
      sessionStorage.getItem = vi.fn().mockImplementation(() => {
        throw new Error("SecurityError");
      });

      expect(getGoogleRedirectReturnUrl()).toBeNull();

      sessionStorage.getItem = originalGetItem;
    });
  });

  describe("Cross-tab isolation (sessionStorage)", () => {
    it("uses sessionStorage not localStorage", () => {
      // Verify we're using sessionStorage
      setGoogleRedirectPending("/test");

      // sessionStorage should have the value
      expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

      // localStorage should NOT have the value (cross-tab isolation)
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("Timestamp expiration boundary", () => {
    it("returns true at exactly 5 minutes (not expired)", () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const data = { timestamp: fiveMinutesAgo, returnUrl: "/" };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      // At exactly 5 minutes, it's not yet expired (edge case)
      expect(isGoogleRedirectPending()).toBe(true);
    });

    it("returns false at 5 minutes + 1ms (expired)", () => {
      const justOverFiveMinutes = Date.now() - (5 * 60 * 1000 + 1);
      const data = { timestamp: justOverFiveMinutes, returnUrl: "/" };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      expect(isGoogleRedirectPending()).toBe(false);
    });
  });
});
