"use client";

/**
 * TEMPORARY TEST PAGE - Remove after designer review
 *
 * This page provides links to test all error pages and states.
 * Visit /error-test to access the test suite.
 */

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/elements/button/Button";
import { Col } from "@/components/layout/Directions";
import { SubmissionErrorBanner } from "@/components/create/components/SubmissionErrorBanner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/elements/empty";
import { ReportErrorState } from "@/components/report/ReportErrorState";
import { ERROR_CODES, ERROR_MESSAGES } from "tttc-common/errors";

export default function ErrorTestPage() {
  const [triggerError, setTriggerError] = useState(false);

  if (triggerError) {
    throw new Error("Test error triggered by button click");
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <Col gap={6}>
        <div>
          <h1 className="text-2xl font-semibold mb-2">Error Page Test Suite</h1>
          <p className="text-muted-foreground">
            Click each link/button to test the different error states and pages.
          </p>
        </div>

        {/* Error Boundary Pages */}
        <section>
          <h2 className="text-lg font-medium mb-3 border-b pb-2">
            Error Boundary Pages
          </h2>
          <Col gap={3}>
            <TestItemWithPreview
              title="App Error Page (error.tsx)"
              description="Shows when a runtime error occurs. Error digest only appears in production builds."
              action={
                <Button
                  onClick={() => setTriggerError(true)}
                  variant="outline"
                  size="sm"
                >
                  Trigger live
                </Button>
              }
            >
              <AppErrorPreview />
            </TestItemWithPreview>

            <TestItemWithPreview
              title="Global Error Page (global-error.tsx)"
              description="Shows when the root layout fails. Uses inline styles."
            >
              <GlobalErrorPreview />
            </TestItemWithPreview>
          </Col>
        </section>

        {/* Static Error Pages */}
        <section>
          <h2 className="text-lg font-medium mb-3 border-b pb-2">
            Static Error Pages
          </h2>
          <Col gap={3}>
            <TestItem
              title="404 Not Found Page"
              description="Shows when navigating to a URL that doesn't exist."
            >
              <Button asChild variant="outline">
                <Link href="/this-page-does-not-exist-12345">
                  Visit Non-existent Page
                </Link>
              </Button>
            </TestItem>
          </Col>
        </section>

        {/* Report Error States */}
        <section>
          <h2 className="text-lg font-medium mb-3 border-b pb-2">
            Report Error States
          </h2>
          <Col gap={3}>
            <TestItemWithPreview
              title="Report Not Found"
              description="Shows when trying to view a report that doesn't exist in the database."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/report/INVALIDREPORTID123">Test live</Link>
                </Button>
              }
            >
              <div className="bg-background">
                <ReportErrorState type="notFound" />
              </div>
            </TestItemWithPreview>

            <TestItemWithPreview
              title="Report Generation Failed"
              description="Shows when a report failed to generate."
            >
              <div className="bg-background">
                <ReportErrorState type="failed" />
              </div>
            </TestItemWithPreview>

            <TestItemWithPreview
              title="Report Load Error"
              description="Shows when there's an issue loading a report."
            >
              <div className="bg-background">
                <ReportErrorState type="loadError" />
              </div>
            </TestItemWithPreview>
          </Col>
        </section>

        {/* All Error Codes */}
        <section>
          <h2 className="text-lg font-medium mb-3 border-b pb-2">
            All Error Codes &amp; Messages
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Complete list of error codes and their user-facing messages. These
            appear as inline banners on forms or in API responses.
          </p>

          {/* Auth Errors */}
          <h3 className="text-md font-medium mt-4 mb-2 text-muted-foreground">
            Authentication Errors
          </h3>
          <Col gap={3}>
            <ErrorPreview code={ERROR_CODES.AUTH_TOKEN_MISSING} />
            <ErrorPreview code={ERROR_CODES.AUTH_TOKEN_INVALID} />
            <ErrorPreview code={ERROR_CODES.AUTH_TOKEN_EXPIRED} />
            <ErrorPreview code={ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED} />
            <ErrorPreview code={ERROR_CODES.AUTH_UNAUTHORIZED} />
          </Col>

          {/* Validation Errors */}
          <h3 className="text-md font-medium mt-6 mb-2 text-muted-foreground">
            Validation Errors
          </h3>
          <Col gap={3}>
            <ErrorPreview code={ERROR_CODES.VALIDATION_ERROR} />
            <ErrorPreview code={ERROR_CODES.INVALID_REQUEST} />
            <ErrorPreview code={ERROR_CODES.CSV_TOO_LARGE} />
            <ErrorPreview code={ERROR_CODES.CSV_INVALID_FORMAT} />
            <ErrorPreview code={ERROR_CODES.CSV_SECURITY_VIOLATION} />
            <ErrorPreview code={ERROR_CODES.INVALID_REPORT_URI} />
          </Col>

          {/* Resource Errors */}
          <h3 className="text-md font-medium mt-6 mb-2 text-muted-foreground">
            Resource Errors
          </h3>
          <Col gap={3}>
            <ErrorPreview code={ERROR_CODES.REPORT_NOT_FOUND} />
            <ErrorPreview code={ERROR_CODES.USER_NOT_FOUND} />
          </Col>

          {/* Rate Limiting */}
          <h3 className="text-md font-medium mt-6 mb-2 text-muted-foreground">
            Rate Limiting
          </h3>
          <Col gap={3}>
            <ErrorPreview code={ERROR_CODES.RATE_LIMIT_EXCEEDED} />
          </Col>

          {/* Server Errors */}
          <h3 className="text-md font-medium mt-6 mb-2 text-muted-foreground">
            Server Errors (with request ID for log correlation)
          </h3>
          <Col gap={3}>
            <ErrorPreview code={ERROR_CODES.INTERNAL_ERROR} showRequestId />
            <ErrorPreview code={ERROR_CODES.PIPELINE_FAILED} showRequestId />
            <ErrorPreview code={ERROR_CODES.STORAGE_ERROR} showRequestId />
            <ErrorPreview
              code={ERROR_CODES.SERVICE_UNAVAILABLE}
              showRequestId
            />
            <ErrorPreview code={ERROR_CODES.DATABASE_ERROR} showRequestId />
          </Col>
        </section>

        {/* Sign In Required */}
        <section>
          <h2 className="text-lg font-medium mb-3 border-b pb-2">
            Sign In Required Page
          </h2>
          <Col gap={3}>
            <TestItemWithPreview
              title="Sign In Required Page"
              description="Shows when visiting /create without being logged in."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/create">View live</Link>
                </Button>
              }
            >
              <SignInRequiredPreview />
            </TestItemWithPreview>
          </Col>
        </section>

        {/* Design Notes */}
        <section className="bg-muted/50 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-2">Design Review Notes</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              Error reference code should be easy to copy (click the Copy
              button)
            </li>
            <li>
              Email support link should pre-fill subject and body with error
              reference
            </li>
            <li>
              All error pages should be centered vertically and horizontally
            </li>
            <li>
              Global error page uses inline styles (test visually matches app
              error page)
            </li>
            <li>Inline form errors use red destructive color scheme</li>
          </ul>
        </section>
      </Col>
    </div>
  );
}

function TestItem({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 border rounded-lg">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function TestItemWithPreview({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-3 bg-muted/50">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="border-t">{children}</div>
    </div>
  );
}

function ErrorPreview({
  code,
  showRequestId = false,
}: {
  code: string;
  showRequestId?: boolean;
}) {
  const message = ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES];
  // Generate a mock request ID for server errors to show what it looks like
  const mockRequestId = showRequestId ? "req-a1b2c3d4e5f6" : undefined;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 bg-muted/50 border-b">
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
          {code}
        </code>
        {showRequestId && (
          <span className="text-xs text-muted-foreground">
            (with request ID)
          </span>
        )}
      </div>
      <div className="p-3 bg-background">
        <SubmissionErrorBanner
          error={{ code, message, requestId: mockRequestId }}
        />
      </div>
    </div>
  );
}

/**
 * Preview of the app error page using actual components with mock digest.
 * This mirrors error.tsx to show what it looks like with a digest.
 */
function AppErrorPreview() {
  const [copied, setCopied] = useState(false);
  const mockDigest = "abc123def456";

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(mockDigest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const supportEmailHref = `mailto:hello@aiobjectives.org?subject=${encodeURIComponent(`Error report: ${mockDigest}`)}&body=${encodeURIComponent(`Hi,\n\nI encountered an error while using Talk to the City.\n\nError reference: ${mockDigest}\n\nWhat I was doing when this happened:\n[Please describe what you were trying to do]\n\nThanks`)}`;

  return (
    <div className="flex min-h-[300px] w-full items-center justify-center bg-background p-8">
      <Empty className="border-0 bg-background p-8 rounded-lg max-w-sm">
        <EmptyHeader>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            We encountered an unexpected error. This has been logged and
            we&apos;ll look into it.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="flex gap-2">
            <Button onClick={(e) => e.preventDefault()} variant="default">
              Try again
            </Button>
            <Button variant="outline" onClick={(e) => e.preventDefault()}>
              Homepage
            </Button>
          </div>

          <Button
            asChild
            variant="link"
            className="text-muted-foreground"
            onClick={(e) => e.preventDefault()}
          >
            <a href={supportEmailHref}>
              Email support
              <svg
                className="ml-1 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </Button>
        </EmptyContent>

        <div className="w-full rounded-lg border bg-muted/50 p-4 text-left">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Error reference
              </span>
              <button
                onClick={copyToClipboard}
                aria-label="Copy error reference"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <>
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <code className="text-sm font-mono text-muted-foreground">
              {mockDigest}
            </code>
            <p className="text-xs text-muted-foreground">
              Include this code when contacting support
            </p>
          </div>
        </div>
      </Empty>
    </div>
  );
}

/**
 * Preview of the global error page using the same inline styles.
 * This mirrors global-error.tsx but without the html/body wrapper.
 */
function GlobalErrorPreview() {
  const [copied, setCopied] = useState(false);
  const mockDigest = "abc123def456";

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(mockDigest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const supportEmailHref = `mailto:hello@aiobjectives.org?subject=${encodeURIComponent(`Error report: ${mockDigest}`)}&body=${encodeURIComponent(`Hi,\n\nI encountered an error while using Talk to the City.\n\nError reference: ${mockDigest}\n\nWhat I was doing when this happened:\n[Please describe what you were trying to do]\n\nThanks`)}`;

  return (
    <div
      style={{
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: "#ffffff",
        color: "#0f172a",
        padding: "48px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: "384px",
          padding: "32px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
        }}
      >
        {/* Header section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            maxWidth: "384px",
          }}
        >
          <h1
            style={{
              fontSize: "16px",
              fontWeight: 500,
              lineHeight: "24px",
              margin: 0,
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "14px",
              lineHeight: "20px",
              color: "#64748b",
              margin: 0,
            }}
          >
            We encountered an unexpected error. This has been logged and
            we&apos;ll look into it.
          </p>
        </div>

        {/* Content section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            width: "100%",
            maxWidth: "384px",
          }}
        >
          {/* Horizontal button group */}
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              style={{
                backgroundColor: "hsl(243, 75%, 59%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              onClick={(e) => e.preventDefault()}
              style={{
                backgroundColor: "transparent",
                color: "#0f172a",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Homepage
            </a>
          </div>

          {/* Email support link */}
          <a
            href={supportEmailHref}
            onClick={(e) => e.preventDefault()}
            style={{
              fontSize: "14px",
              color: "#64748b",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            Email support
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>

        {/* Error reference box */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px",
            textAlign: "left",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#0f172a",
                }}
              >
                Error reference
              </span>
              <button
                onClick={copyToClipboard}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12px",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {copied ? (
                  <>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <code
              style={{
                fontSize: "14px",
                fontFamily: "monospace",
                color: "#64748b",
              }}
            >
              {mockDigest}
            </code>
            <p
              style={{
                fontSize: "12px",
                color: "#64748b",
                marginTop: "0",
                marginBottom: 0,
              }}
            >
              Include this code when contacting support
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Preview of the sign-in required page using actual components.
 */
function SignInRequiredPreview() {
  return (
    <div className="flex min-h-[300px] w-full items-center justify-center bg-background p-8">
      <Empty className="border-0 bg-background p-8 rounded-lg max-w-sm">
        <EmptyHeader>
          <EmptyTitle>Sign in required</EmptyTitle>
          <EmptyDescription>
            Please sign in to create a report.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="flex gap-2">
            <Button onClick={(e) => e.preventDefault()} variant="default">
              Sign in with Google
            </Button>
            <Button variant="outline" onClick={(e) => e.preventDefault()}>
              Homepage
            </Button>
          </div>

          <Button
            asChild
            variant="link"
            className="text-muted-foreground"
            onClick={(e) => e.preventDefault()}
          >
            <a href="mailto:hello@aiobjectives.org">
              Email support
              <svg
                className="ml-1 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
