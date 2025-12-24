import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as userLimitsModule from "@/lib/api/userLimits";
import * as getUserModule from "@/lib/hooks/getUser";
import { useUserCapabilities } from "../useUserCapabilities";

// Mock the userLimits API module
vi.mock("@/lib/api/userLimits", () => ({
  getUserCapabilities: vi.fn(),
}));

// Mock the useUser hook
vi.mock("@/lib/hooks/getUser", () => ({
  useUser: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests for faster execution
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useUserCapabilities", () => {
  const mockGetUserCapabilities = vi.mocked(
    userLimitsModule.getUserCapabilities,
  );
  const mockUseUser = vi.mocked(getUserModule.useUser);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user, auth not loading
    mockUseUser.mockReturnValue({
      user: { uid: "test-user-123" } as any,
      loading: false,
      error: null,
      emailVerified: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should initialize with default values while loading", () => {
    mockUseUser.mockReturnValue({
      user: null,
      loading: true,
      error: null,
      emailVerified: false,
    });

    const { result } = renderHook(() => useUserCapabilities(), {
      wrapper: createWrapper(),
    });

    expect(result.current.userSizeLimit).toBe(150 * 1024); // Default 150KB
    expect(result.current.capabilitiesLoaded).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("should update userSizeLimit when API returns capabilities", async () => {
    const mockCapabilities = {
      csvSizeLimit: 2 * 1024 * 1024, // 2MB
    };

    mockGetUserCapabilities.mockResolvedValue(mockCapabilities);

    const { result } = renderHook(() => useUserCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.capabilitiesLoaded).toBe(true);
    });

    expect(result.current.userSizeLimit).toBe(2 * 1024 * 1024);
    expect(mockGetUserCapabilities).toHaveBeenCalledOnce();
  });

  it("should keep default size when user is not authenticated", async () => {
    mockUseUser.mockReturnValue({
      user: null,
      loading: false,
      error: null,
      emailVerified: false,
    });

    const { result } = renderHook(() => useUserCapabilities(), {
      wrapper: createWrapper(),
    });

    // Query is disabled when no user, so it should immediately be "loaded"
    await waitFor(() => {
      expect(result.current.capabilitiesLoaded).toBe(true);
    });

    expect(result.current.userSizeLimit).toBe(150 * 1024);
    // API should not be called when user is null
    expect(mockGetUserCapabilities).not.toHaveBeenCalled();
  });

  it("should keep default size when API returns null", async () => {
    mockGetUserCapabilities.mockResolvedValue(null);

    const { result } = renderHook(() => useUserCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.capabilitiesLoaded).toBe(true);
    });

    expect(result.current.userSizeLimit).toBe(150 * 1024);
  });

  it("should set capabilitiesLoaded to true even when API fails", async () => {
    mockGetUserCapabilities.mockRejectedValue(new Error("API error"));

    const { result } = renderHook(() => useUserCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.capabilitiesLoaded).toBe(true);
    });

    expect(result.current.userSizeLimit).toBe(150 * 1024);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("should not call API again after successful load", async () => {
    const mockCapabilities = {
      csvSizeLimit: 1024 * 1024, // 1MB
    };

    mockGetUserCapabilities.mockResolvedValue(mockCapabilities);

    const { result, rerender } = renderHook(() => useUserCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.capabilitiesLoaded).toBe(true);
    });

    const initialCallCount = mockGetUserCapabilities.mock.calls.length;

    // Rerender the hook
    rerender();

    // Should not make additional API calls after rerender (React Query caches)
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
      mockGetUserCapabilities.mockResolvedValue(capabilities);

      // Each iteration needs a fresh QueryClient to avoid cache
      const { result } = renderHook(() => useUserCapabilities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.capabilitiesLoaded).toBe(true);
      });

      expect(result.current.userSizeLimit).toBe(capabilities.csvSizeLimit);
    }
  });
});
