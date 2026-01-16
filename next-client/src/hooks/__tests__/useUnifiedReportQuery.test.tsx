import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ReportRef } from "tttc-common/firebase";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchReport,
  transformToReportState,
  useUnifiedReportQuery,
} from "../useUnifiedReportQuery";

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

describe("useUnifiedReportQuery", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return loading state initially", () => {
    // Never resolves to keep in loading state
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useUnifiedReportQuery("test-id"), {
      wrapper: createWrapper(),
    });

    expect(result.current.type).toBe("loading");
  });

  it("should return ready state when report is finished", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "finished",
          dataUrl: "https://storage.example.com/report.json",
          metadata: { id: "test-id", title: "Test Report" },
        }),
    });

    const { result } = renderHook(() => useUnifiedReportQuery("test-id"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.type).toBe("ready");
    });

    if (result.current.type === "ready") {
      expect(result.current.dataUrl).toBe(
        "https://storage.example.com/report.json",
      );
      expect(result.current.metadata?.id).toBe("test-id");
    }
  });

  it("should return not-found state on 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    });

    const { result } = renderHook(() => useUnifiedReportQuery("nonexistent"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.type).toBe("not-found");
    });
  });

  it("should return processing state while report is being generated", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "clustering",
          metadata: { id: "processing-id" },
        }),
    });

    const { result } = renderHook(
      () => useUnifiedReportQuery("processing-id"),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.type).toBe("processing");
    });

    if (result.current.type === "processing") {
      expect(result.current.status).toBe("clustering");
    }
  });

  // Note: Network/HTTP error handling through React Query has timing issues in isolated tests.
  // Error handling is verified via direct unit tests for fetchReport and transformToReportState below.

  it("should return error state when report generation failed", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "failed" }),
    });

    const { result } = renderHook(() => useUnifiedReportQuery("failed-id"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.type).toBe("error");
    });

    if (result.current.type === "error") {
      expect(result.current.message).toBe("Report generation failed");
    }
  });

  it("should encode identifier in API request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "finished",
          dataUrl: "https://storage.example.com/report.json",
        }),
    });

    renderHook(() => useUnifiedReportQuery("bucket/path/report.json"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/report/bucket%2Fpath%2Freport.json",
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    });
  });

  it("should include metadata when available in processing state", async () => {
    const metadata = {
      id: "test-123",
      title: "My Test Report",
      description: "A test report",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "summarizing",
          metadata,
        }),
    });

    const { result } = renderHook(
      () => useUnifiedReportQuery("with-metadata"),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.type).toBe("processing");
    });

    if (result.current.type === "processing") {
      expect(result.current.metadata).toEqual(metadata);
    }
  });

  it("should include metadata when available in ready state", async () => {
    const metadata = {
      id: "test-123",
      title: "My Test Report",
      description: "A test report",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "finished",
          dataUrl: "https://storage.example.com/report.json",
          metadata,
        }),
    });

    const { result } = renderHook(
      () => useUnifiedReportQuery("with-metadata"),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.type).toBe("ready");
    });

    if (result.current.type === "ready") {
      expect(result.current.metadata).toEqual(metadata);
    }
  });
});

/**
 * Direct unit tests for pure functions.
 * These avoid React Query timing issues by testing the functions directly.
 */
describe("fetchReport", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return response data on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "finished",
          dataUrl: "https://example.com/report.json",
        }),
    });

    const result = await fetchReport("test-id");

    expect(result).toEqual({
      status: "finished",
      dataUrl: "https://example.com/report.json",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/report/test-id",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("should return notFound status on 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    });

    const result = await fetchReport("nonexistent");

    expect(result).toEqual({ status: "notFound" });
  });

  it("should throw on HTTP errors (non-404)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(fetchReport("error-id")).rejects.toThrow(
      "HTTP 500: Internal Server Error",
    );
  });

  it("should handle text() error gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error("Text read failed")),
    });

    await expect(fetchReport("error-id")).rejects.toThrow(
      "HTTP 500: Unknown error",
    );
  });

  it("should encode identifier with special characters", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "finished", dataUrl: "url" }),
    });

    await fetchReport("bucket/path/report.json");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/report/bucket%2Fpath%2Freport.json",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });
});

describe("transformToReportState", () => {
  it("should return error state when isError is true", () => {
    const result = transformToReportState(
      undefined,
      false,
      true,
      new Error("Network failure"),
    );

    expect(result).toEqual({ type: "error", message: "Network failure" });
  });

  it("should return loading state when isLoading and no data", () => {
    const result = transformToReportState(undefined, true, false, null);

    expect(result).toEqual({ type: "loading" });
  });

  it("should return loading state when no data and not loading", () => {
    const result = transformToReportState(undefined, false, false, null);

    expect(result).toEqual({ type: "loading" });
  });

  it("should return not-found state when status is notFound", () => {
    const result = transformToReportState(
      { status: "notFound" },
      false,
      false,
      null,
    );

    expect(result).toEqual({ type: "not-found" });
  });

  it("should return ready state when status is finished with dataUrl", () => {
    // Partial metadata for testing - full ReportRef not required
    const metadata = {
      id: "test",
      title: "Test Report",
    } as unknown as ReportRef;
    const result = transformToReportState(
      {
        status: "finished",
        dataUrl: "https://example.com/report.json",
        metadata,
      },
      false,
      false,
      null,
    );

    expect(result).toEqual({
      type: "ready",
      dataUrl: "https://example.com/report.json",
      metadata,
    });
  });

  it("should return error state when status is failed", () => {
    const result = transformToReportState(
      { status: "failed" },
      false,
      false,
      null,
    );

    expect(result).toEqual({
      type: "error",
      message: "Report generation failed",
    });
  });

  it("should return error state when status is finished but dataUrl is missing", () => {
    const result = transformToReportState(
      { status: "finished" }, // No dataUrl
      false,
      false,
      null,
    );

    expect(result).toEqual({
      type: "error",
      message: "Report finished but data URL missing",
    });
  });

  it("should return processing state for non-terminal statuses", () => {
    // Partial metadata for testing - full ReportRef not required
    const metadata = {
      id: "test",
      title: "Test Report",
    } as unknown as ReportRef;
    const result = transformToReportState(
      { status: "clustering", metadata },
      false,
      false,
      null,
    );

    expect(result).toEqual({
      type: "processing",
      status: "clustering",
      metadata,
    });
  });

  it("should prioritize error state over data state", () => {
    const result = transformToReportState(
      { status: "finished", dataUrl: "https://example.com/report.json" },
      false,
      true,
      new Error("Something went wrong"),
    );

    expect(result).toEqual({ type: "error", message: "Something went wrong" });
  });
});
