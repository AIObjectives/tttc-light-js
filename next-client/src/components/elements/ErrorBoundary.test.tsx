import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

// Test component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
};

// Suppress console.error for cleaner test output
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Clean up DOM between tests
afterEach(() => {
  cleanup();
});

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("catches errors and displays default fallback UI", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We encountered an error while displaying this content.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
  });

  it("displays custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error message</div>}>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom error message")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("supports function fallback with reset callback", () => {
    render(
      <ErrorBoundary
        fallback={(reset) => (
          <div>
            <p>Error occurred</p>
            <button onClick={reset}>Reset</button>
          </div>
        )}
      >
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Error occurred")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("resets error state when Try Again button is clicked", () => {
    let shouldThrow = true;
    const TestComponent = () => <ThrowError shouldThrow={shouldThrow} />;

    const { rerender } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>,
    );

    // Error is caught
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the error condition BEFORE clicking reset
    shouldThrow = false;

    // Click Try Again - this will clear the error state
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    // Should render children successfully now that error is cleared
    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("calls custom reset function when provided", () => {
    let shouldThrow = true;
    const TestComponent = () => <ThrowError shouldThrow={shouldThrow} />;

    render(
      <ErrorBoundary
        fallback={(reset) => (
          <div>
            <p>Custom error</p>
            <button onClick={() => reset()}>Custom Reset</button>
          </div>
        )}
      >
        <TestComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom error")).toBeInTheDocument();

    // Fix error condition and reset
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Custom Reset" }));

    // Should render children successfully
    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("displays error details in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // Should have error details section with retry count
    expect(
      screen.getByText(/Error details \(retry \d+\/3\)/),
    ).toBeInTheDocument();

    // Should display error message
    expect(screen.getByText(/Test error/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it("hides error details in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // Should not have error details section in production
    expect(screen.queryByText("Error details")).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it("handles multiple sequential errors", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // First error
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Reset
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    // Error again
    rerender(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // Should still display error UI
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows refresh button after exceeding retry limit", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // First error
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We encountered an error while displaying this content.",
      ),
    ).toBeInTheDocument();

    // Trigger 2 more errors by clicking Try Again (total 3 errors = threshold)
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
      rerender(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      );
    }

    // After hitting threshold (3 errors), should show refresh button and different message
    expect(
      screen.queryByRole("button", { name: "Try Again" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh Page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This error persists after multiple retry attempts. Please refresh the page to continue.",
      ),
    ).toBeInTheDocument();
  });

  it("resets error count on successful recovery", async () => {
    let shouldThrow = true;
    const TestComponent = () => <ThrowError shouldThrow={shouldThrow} />;

    const { rerender } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>,
    );

    // First error
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Trigger another error
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    rerender(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>,
    );

    // Fix the error condition
    shouldThrow = false;

    // Click Try Again - this should clear error state and reset counter
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    // Should render children successfully
    expect(screen.getByText("No error")).toBeInTheDocument();

    // Wait for error count to reset asynchronously
    await waitFor(() => {
      expect(screen.getByText("No error")).toBeInTheDocument();
    });

    // Now if error occurs again, should start from count 1
    shouldThrow = true;
    rerender(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>,
    );

    // Should show Try Again (not Refresh Page)
    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We encountered an error while displaying this content.",
      ),
    ).toBeInTheDocument();
  });
});
