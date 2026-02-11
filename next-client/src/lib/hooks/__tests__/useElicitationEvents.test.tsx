import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ElicitationEventSummary } from "tttc-common/firebase";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchElicitationEvents,
  useElicitationEvents,
} from "../useElicitationEvents";

// Mock the browser logger
vi.mock("tttc-common/logger/browser", () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock useUserQuery to avoid Firebase initialization
vi.mock("@/lib/query/useUserQuery", () => ({
  useUserQuery: () => ({
    user: null,
    loading: false,
    error: null,
    emailVerified: false,
  }),
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

const mockEvents: ElicitationEventSummary[] = [
  {
    id: "event-1",
    eventName: "Community Feedback Session",
    ownerUserId: "user-123",
    responderCount: 42,
    createdAt: new Date("2026-01-15T10:00:00Z"),
  },
  {
    id: "event-2",
    eventName: "Product Survey",
    ownerUserId: "user-456",
    responderCount: 18,
    createdAt: new Date("2026-01-20T14:30:00Z"),
  },
];

describe("useElicitationEvents", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return empty array and loading state initially", () => {
    // Never resolves to keep in loading state
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useElicitationEvents(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.events).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("should return events when fetch succeeds", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockEvents }),
    });

    const { result } = renderHook(() => useElicitationEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toEqual(mockEvents);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it("should return empty array when no events exist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });

    const { result } = renderHook(() => useElicitationEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("should handle fetch errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const { result } = renderHook(() => useElicitationEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain("HTTP 500");
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useElicitationEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeDefined();
  });

  it("should provide refresh function", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockEvents }),
    });

    const { result } = renderHook(() => useElicitationEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.refresh).toBeDefined();
    expect(typeof result.current.refresh).toBe("function");

    // Update mock to return different data
    const updatedEvents = [
      ...mockEvents,
      {
        id: "event-3",
        eventName: "New Event",
        ownerUserId: "user-789",
        responderCount: 5,
        createdAt: new Date("2026-01-25T16:00:00Z"),
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: updatedEvents }),
    });

    // Trigger refresh
    result.current.refresh();

    await waitFor(() => {
      expect(result.current.events).toEqual(updatedEvents);
    });
  });

  it("should call API endpoint with correct path", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });

    renderHook(() => useElicitationEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/elicitation/events",
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    });
  });
});

/**
 * Direct unit tests for the fetch function.
 * These avoid React Query timing issues by testing the function directly.
 */
describe("fetchElicitationEvents", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return events array on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockEvents }),
    });

    const result = await fetchElicitationEvents();

    expect(result).toEqual(mockEvents);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/elicitation/events",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("should include auth token when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: mockEvents }),
    });

    const authToken = "test-token-123";
    await fetchElicitationEvents(authToken);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/elicitation/events",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${authToken}`);
  });

  it("should not include auth header when token is not provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });

    await fetchElicitationEvents();

    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("should throw on HTTP errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    });

    await expect(fetchElicitationEvents()).rejects.toThrow("HTTP 403: Forbidden");
  });

  it("should handle text() error gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error("Text read failed")),
    });

    await expect(fetchElicitationEvents()).rejects.toThrow(
      "HTTP 500: Unknown error",
    );
  });

  it("should return empty array when API returns empty events", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });

    const result = await fetchElicitationEvents();

    expect(result).toEqual([]);
  });

  it("should handle malformed response gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("Invalid JSON")),
    });

    await expect(fetchElicitationEvents()).rejects.toThrow("Invalid JSON");
  });
});
