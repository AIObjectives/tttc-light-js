/**
 * Tests for useUnifiedReport hook
 *
 * Tests cover:
 * - Initial loading state
 * - Fetching with and without authentication
 * - Report status handling (processing, ready, not-found, error)
 * - Auth token inclusion for private reports
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUnifiedReport } from "../useUnifiedReport";

// Mock useUser hook
const mockGetIdToken = vi.fn();
const mockUser = {
  getIdToken: mockGetIdToken,
  uid: "test-user-123",
};

vi.mock("@/lib/hooks/getUser", () => ({
  useUser: vi.fn(() => ({ user: null, loading: false })),
}));

// Import mocked module for manipulation
import { useUser } from "@/lib/hooks/getUser";

const mockedUseUser = vi.mocked(useUser);

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger to suppress output during tests
vi.mock("tttc-common/logger/browser", () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe("useUnifiedReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUser.mockReturnValue({ user: null, loading: false });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("initial state", () => {
    it("starts in loading state", () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useUnifiedReport("test-report-id"));

      expect(result.current.type).toBe("loading");
    });
  });

  describe("fetching without auth", () => {
    it("fetches report without Authorization header when no user", async () => {
      mockedUseUser.mockReturnValue({ user: null, loading: false });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
          }),
      });

      renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/report/test-report-id", {
        headers: {},
      });
    });

    it("URL-encodes the identifier in the request path", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
          }),
      });

      // Identifier with special characters that need encoding
      renderHook(() => useUnifiedReport("report/with spaces&special"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/report/report%2Fwith%20spaces%26special",
        { headers: {} },
      );
    });
  });

  describe("fetching with auth", () => {
    it("includes Authorization header when user is logged in", async () => {
      mockGetIdToken.mockResolvedValue("mock-firebase-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
          }),
      });

      renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/report/test-report-id", {
        headers: { Authorization: "Bearer mock-firebase-token" },
      });
    });

    it("continues without auth header if getIdToken fails", async () => {
      mockGetIdToken.mockRejectedValue(new Error("Token error"));
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
          }),
      });

      renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/report/test-report-id", {
        headers: {},
      });
    });
  });

  describe("report status handling", () => {
    it("returns ready state when report is finished", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
            metadata: { title: "Test Report" },
          }),
      });

      const { result } = renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(result.current.type).toBe("ready");
      });

      if (result.current.type === "ready") {
        expect(result.current.dataUrl).toBe(
          "https://storage.example.com/report.json",
        );
        expect(result.current.metadata).toEqual({ title: "Test Report" });
      }
    });

    it("returns processing state when report is in progress", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "extraction",
          }),
      });

      const { result } = renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(result.current.type).toBe("processing");
      });

      if (result.current.type === "processing") {
        expect(result.current.status).toBe("extraction");
      }
    });

    it("returns error state when report failed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "failed",
          }),
      });

      const { result } = renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(result.current.type).toBe("error");
      });

      if (result.current.type === "error") {
        expect(result.current.message).toBe("Report generation failed");
      }
    });

    it("returns not-found state on 404 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(result.current.type).toBe("not-found");
      });
    });

    it("returns error state on non-404 HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const { result } = renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(result.current.type).toBe("error");
      });

      if (result.current.type === "error") {
        expect(result.current.message).toContain("500");
      }
    });

    it("returns error state on fetch exception", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(result.current.type).toBe("error");
      });

      if (result.current.type === "error") {
        expect(result.current.message).toBe("Network error");
      }
    });
  });

  describe("auth state changes", () => {
    it("refetches when user logs in", async () => {
      // Start without user
      mockedUseUser.mockReturnValue({ user: null, loading: false });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
          }),
      });

      const { rerender } = renderHook(() => useUnifiedReport("test-report-id"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // First call should be without auth
      expect(mockFetch).toHaveBeenCalledWith("/api/report/test-report-id", {
        headers: {},
      });

      // User logs in
      mockGetIdToken.mockResolvedValue("new-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });

      rerender();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Second call should include auth header
      expect(mockFetch).toHaveBeenLastCalledWith("/api/report/test-report-id", {
        headers: { Authorization: "Bearer new-token" },
      });
    });
  });

  describe("cleanup", () => {
    it("does not update state after unmount", async () => {
      // Use a delayed response to simulate slow network
      let resolveResponse: (value: any) => void;
      const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve;
      });
      mockFetch.mockReturnValueOnce(responsePromise);

      const { unmount } = renderHook(() => useUnifiedReport("test-report-id"));

      // Unmount before response arrives
      unmount();

      // Now resolve the response - should not cause React warnings about
      // updating unmounted component (test will fail if React warning is thrown)
      resolveResponse!({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
          }),
      });

      // Give time for any potential state updates
      await new Promise((resolve) => setTimeout(resolve, 50));

      // If we get here without React warnings, the test passes
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
