"use client";

import type React from "react";
import { Component, type ReactNode } from "react";
import { Col } from "../layout";
import { Button } from "./button/Button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
  /** Maximum number of retry attempts before suggesting page refresh. Defaults to 3. */
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

/**
 * Error Boundary component that catches React errors and displays a fallback UI
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With reset function
 * <ErrorBoundary fallback={(reset) => (
 *   <div>
 *     <p>Error occurred</p>
 *     <button onClick={reset}>Try Again</button>
 *   </div>
 * )}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Increment error count
    this.setState((prevState) => ({
      errorCount: prevState.errorCount + 1,
    }));

    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Reset error count when successfully recovering from error state
    if (
      prevState.hasError &&
      !this.state.hasError &&
      this.state.errorCount > 0
    ) {
      this.setState({ errorCount: 0 });
    }
  }

  reset() {
    // Don't reset errorCount here - it should accumulate across retries
    // Only reset when component successfully renders (componentDidUpdate)
    this.setState({ hasError: false, error: undefined });
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        // Check if fallback is a function that expects reset callback
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(this.reset);
        }
        return this.props.fallback;
      }

      // Default fallback UI with reset button
      const maxRetries = this.props.maxRetries ?? 3;
      const tooManyRetries = this.state.errorCount >= maxRetries;

      return (
        <Col
          gap={4}
          className="p-8 border border-destructive rounded-md bg-destructive/5"
        >
          <div>
            <h3 className="text-lg font-semibold text-destructive">
              Something went wrong
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {tooManyRetries
                ? "This error persists after multiple retry attempts. Please refresh the page to continue."
                : "We encountered an error while displaying this content."}
            </p>
          </div>
          <div>
            {tooManyRetries ? (
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                Refresh Page
              </Button>
            ) : (
              <Button onClick={this.reset} variant="outline" size="sm">
                Try Again
              </Button>
            )}
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">
                Error details (retry {this.state.errorCount}/{maxRetries})
              </summary>
              <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto">
                {this.state.error.toString()}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </Col>
      );
    }

    return this.props.children;
  }
}
