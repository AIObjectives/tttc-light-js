import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as userLimitsModule from "@/lib/api/userLimits";
import { useUserCapabilities } from "../useUserCapabilities";

// Mock the userLimits API module
vi.mock("@/lib/api/userLimits", () => ({
  getUserCapabilities: vi.fn(),
}));

describe("useUserCapabilities", () => {
  const mockGetUserCapabilities = vi.mocked(
    userLimitsModule.getUserCapabilities,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should initialize with default values", () => {
    // Mock API to never resolve to test initial state
    mockGetUserCapabilities.mockImplementation(
      () => new Promise(() => {}), // Never resolving promise
    );

    const { result } = renderHook(() => useUserCapabilities());

    expect(result.current.userSizeLimit).toBe(150 * 1024); // Default 150KB
    expect(result.current.capabilitiesLoaded).toBe(false);
  });

  it("should update userSizeLimit when API returns capabilities", async () => {
    const mockCapabilities = {
      csvSizeLimit: 2 * 1024 * 1024, // 2MB
    };

    mockGetUserCapabilities.mockResolvedValue(mockCapabilities);

    const { result } = renderHook(() => useUserCapabilities());

    await waitFor(() => {
      expect(result.current.capabilitiesLoaded).toBe(true);
    });

    expect(result.current.userSizeLimit).toBe(2 * 1024 * 1024);
    expect(mockGetUserCapabilities).toHaveBeenCalledOnce();
  });

  it("should keep default size when API returns null", async () => {
    mockGetUserCapabilities.mockResolvedValue(null);

    const { result } = renderHook(() => useUserCapabilities());

    await waitFor(() => {
      expect(result.current.capabilitiesLoaded).toBe(true);
    });

    expect(result.current.userSizeLimit).toBe(150 * 1024); // Should remain default
  });

  it("should set capabilitiesLoaded to true even when API fails", async () => {
    mockGetUserCapabilities.mockRejectedValue(new Error("API error"));

    const { result } = renderHook(() => useUserCapabilities());

    await waitFor(
      () => {
        expect(result.current.capabilitiesLoaded).toBe(true);
      },
      { timeout: 15000 },
    ); // Allow time for 3 retries with exponential backoff

    expect(result.current.userSizeLimit).toBe(150 * 1024); // Should remain default
  }, 20000); // Set test timeout to 20 seconds

  it("should not call API again after successful load", async () => {
    const mockCapabilities = {
      csvSizeLimit: 1024 * 1024, // 1MB
    };

    mockGetUserCapabilities.mockResolvedValue(mockCapabilities);

    const { result, rerender } = renderHook(() => useUserCapabilities());

    await waitFor(() => {
      expect(result.current.capabilitiesLoaded).toBe(true);
    });

    const initialCallCount = mockGetUserCapabilities.mock.calls.length;

    // Rerender the hook
    rerender();

    // Should not make additional API calls after rerender
    expect(mockGetUserCapabilities.mock.calls.length).toBe(initialCallCount);
    expect(result.current.userSizeLimit).toBe(1024 * 1024);
  });

  it("should handle different capability values correctly", async () => {
    const testCases = [
      { csvSizeLimit: 100 * 1024 }, // 100KB
      { csvSizeLimit: 500 * 1024 }, // 500KB
      { csvSizeLimit: 5 * 1024 * 1024 }, // 5MB
    ];

    for (const capabilities of testCases) {
      vi.clearAllMocks();
      mockGetUserCapabilities.mockResolvedValue(capabilities);

      const { result } = renderHook(() => useUserCapabilities());

      await waitFor(() => {
        expect(result.current.capabilitiesLoaded).toBe(true);
      });

      expect(result.current.userSizeLimit).toBe(capabilities.csvSizeLimit);
    }
  });
});
