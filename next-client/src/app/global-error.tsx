"use client";

import { useEffect, useState } from "react";

/**
 * Global error boundary for root layout errors.
 * This is a fallback when the root layout itself fails to render.
 * Must include own html/body tags since the root layout may have errored.
 * Uses inline styles since CSS files may not be available.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error("Global error:", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  const copyToClipboard = async () => {
    if (error.digest) {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const supportEmailHref = error.digest
    ? `mailto:hello@aiobjectives.org?subject=${encodeURIComponent(`Error report: ${error.digest}`)}&body=${encodeURIComponent(`Hi,\n\nI encountered an error while using Talk to the City.\n\nError reference: ${error.digest}\n\nWhat I was doing when this happened:\n[Please describe what you were trying to do]\n\nThanks`)}`
    : "mailto:hello@aiobjectives.org";

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: "#ffffff",
          color: "#0f172a",
          margin: 0,
          padding: 0,
          minHeight: "100vh",
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
                onClick={reset}
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
          {error.digest && (
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
                    aria-label="Copy error reference"
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
                          aria-hidden="true"
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
                          aria-hidden="true"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                  {copied && (
                    <span
                      style={{
                        position: "absolute",
                        width: "1px",
                        height: "1px",
                        padding: 0,
                        margin: "-1px",
                        overflow: "hidden",
                        clip: "rect(0, 0, 0, 0)",
                        whiteSpace: "nowrap",
                        border: 0,
                      }}
                    >
                      Error reference copied to clipboard
                    </span>
                  )}
                </div>
                <code
                  style={{
                    fontSize: "14px",
                    fontFamily: "monospace",
                    color: "#64748b",
                  }}
                >
                  {error.digest}
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
          )}
        </div>
      </body>
    </html>
  );
}
