/**
 * Tests for PrivateReportGuard component
 *
 * Tests cover:
 * - Loading state while auth is pending
 * - NotFound state when no user is logged in
 * - Fetch with auth headers when user is logged in
 * - Retry logic on 404 responses
 * - Error handling
 * - Progress state rendering
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateReportGuard } from "../PrivateReportGuard";

// Mock useUser hook
const mockGetIdToken = vi.fn();
const mockUser = {
  getIdToken: mockGetIdToken,
  uid: "test-user-123",
};

vi.mock("@/lib/query/useUserQuery", () => ({
  useUserQuery: vi.fn(() => ({ user: null, loading: true })),
}));

import { useUserQuery } from "@/lib/query/useUserQuery";

const mockedUseUser = vi.mocked(useUserQuery);

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock child components to simplify testing
vi.mock("../ReportErrorState", () => ({
  ReportErrorState: ({ type, message }: { type: string; message?: string }) => (
    <div data-testid="error-state" data-type={type}>
      {message || type}
    </div>
  ),
}));

vi.mock("../../reportProgress/ReportProgress", () => ({
  default: ({ status }: { status: string }) => (
    <div data-testid="report-progress" data-status={status}>
      Processing: {status}
    </div>
  ),
}));

vi.mock("../Report", () => ({
  default: ({ reportId }: { reportId: string }) => (
    <div data-testid="report" data-report-id={reportId}>
      Report Content
    </div>
  ),
}));

vi.mock("../../feedback/Feedback", () => ({
  default: () => <div data-testid="feedback">Feedback</div>,
}));

// Mock handleResponseData
vi.mock("@/lib/report/handleResponseData", () => ({
  handleResponseData: vi.fn(),
}));

import { handleResponseData } from "@/lib/report/handleResponseData";

const mockedHandleResponseData = vi.mocked(handleResponseData);

// Mock schema parsing
vi.mock("tttc-common/schema", () => ({
  pipelineOutput: {
    parse: vi.fn((data) => data),
  },
}));

describe("PrivateReportGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUser.mockReturnValue({ user: null, loading: true });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  describe("loading state", () => {
    it("shows loading message while auth is pending", () => {
      mockedUseUser.mockReturnValue({ user: null, loading: true });

      render(<PrivateReportGuard reportId="test-123" />);

      expect(screen.getByText("Checking access...")).toBeInTheDocument();
    });
  });

  describe("no user", () => {
    it("shows notFound when auth loads but no user", async () => {
      mockedUseUser.mockReturnValue({ user: null, loading: false });

      render(<PrivateReportGuard reportId="test-123" />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toHaveAttribute(
          "data-type",
          "notFound",
        );
      });
    });
  });

  describe("authenticated user", () => {
    it("fetches report with auth header when user is logged in", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "extraction",
          }),
      });

      render(<PrivateReportGuard reportId="test-123" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/report/test-123?includeData=true",
          {
            headers: {
              Authorization: "Bearer mock-token",
            },
          },
        );
      });
    });

    it("shows progress state when report is processing", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "extraction",
          }),
      });

      render(<PrivateReportGuard reportId="test-123" />);

      await waitFor(() => {
        expect(screen.getByTestId("report-progress")).toHaveAttribute(
          "data-status",
          "extraction",
        );
      });
    });

    it("shows error state on non-404 HTTP error", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<PrivateReportGuard reportId="test-123" />);

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toHaveAttribute(
          "data-type",
          "loadError",
        );
      });
    });

    it("shows error state on fetch exception", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<PrivateReportGuard reportId="test-123" />);

      await waitFor(() => {
        const errorState = screen.getByTestId("error-state");
        expect(errorState).toHaveAttribute("data-type", "loadError");
        expect(errorState).toHaveTextContent("Network error");
      });
    });
  });

  describe("retry logic", () => {
    it("retries on 404 up to MAX_RETRIES times", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });

      // All attempts return 404
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      render(<PrivateReportGuard reportId="test-123" />);

      // Wait for retries to complete (MAX_RETRIES = 2, so 3 total attempts)
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(3);
        },
        { timeout: 5000 },
      );

      // Should show notFound after all retries exhausted
      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toHaveAttribute(
          "data-type",
          "notFound",
        );
      });
    }, 10000);

    it("succeeds on retry if second attempt works", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });

      // First attempt: 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      // Second attempt: success with processing status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "summarizing",
          }),
      });

      render(<PrivateReportGuard reportId="test-123" />);

      await waitFor(
        () => {
          expect(screen.getByTestId("report-progress")).toHaveAttribute(
            "data-status",
            "summarizing",
          );
        },
        { timeout: 5000 },
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe("report data handling", () => {
    it("renders Report component when report is finished and data is valid", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      // Single fetch: Server returns report with included data (includeData=true)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
            reportData: { title: "Test Report" },
          }),
      });

      mockedHandleResponseData.mockResolvedValueOnce({
        tag: "report",
        data: { title: "Test Report" } as any,
      });

      render(<PrivateReportGuard reportId="test-123" />);

      await waitFor(() => {
        expect(screen.getByTestId("report")).toBeInTheDocument();
      });
    });

    it("shows error state when handleResponseData returns error", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      // Single fetch: Server returns report with included data (includeData=true)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            dataUrl: "https://storage.example.com/report.json",
            reportData: { invalid: "data" },
          }),
      });

      mockedHandleResponseData.mockResolvedValueOnce({
        tag: "error",
        message: "Invalid report data",
      });

      render(<PrivateReportGuard reportId="test-123" />);

      await waitFor(() => {
        const errorState = screen.getByTestId("error-state");
        expect(errorState).toHaveAttribute("data-type", "loadError");
        expect(errorState).toHaveTextContent("Invalid report data");
      });
    });
  });

  describe("hasTriedAuth guard", () => {
    it("does not refetch after initial auth attempt completes", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "extraction",
          }),
      });

      const { rerender } = render(<PrivateReportGuard reportId="test-123" />);

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Rerender the component (simulating React re-render)
      rerender(<PrivateReportGuard reportId="test-123" />);

      // Should not fetch again due to hasTriedAuth guard
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup", () => {
    it("handles unmount during fetch gracefully", async () => {
      mockGetIdToken.mockResolvedValue("mock-token");
      mockedUseUser.mockReturnValue({
        user: mockUser as any,
        loading: false,
      });

      // Use a delayed response
      let resolveResponse: (value: any) => void;
      const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve;
      });
      mockFetch.mockReturnValueOnce(responsePromise);

      const { unmount } = render(<PrivateReportGuard reportId="test-123" />);

      // Unmount before response arrives
      unmount();

      // Resolve the response after unmount - should not cause errors
      resolveResponse!({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "finished",
            reportData: { title: "Test" },
          }),
      });

      // Give time for any potential state updates
      await new Promise((resolve) => setTimeout(resolve, 50));

      // If we get here without React warnings, the test passes
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
