"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/elements/button/Button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/elements/empty";
import { Center } from "@/components/layout/Center";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log error digest for debugging (safe to expose - no sensitive data)
    console.error("Application error:", {
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
    <Center>
      <Empty className="border-0 bg-background p-8 rounded-lg max-w-sm">
        <EmptyHeader>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            We encountered an unexpected error. This has been logged and we'll
            look into it.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Homepage</Link>
            </Button>
          </div>

          <Button asChild variant="link" className="text-muted-foreground">
            <a href={supportEmailHref}>
              Email support
              <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </EmptyContent>

        {error.digest && (
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
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      Copy
                    </>
                  )}
                </button>
                {copied && (
                  <span className="sr-only">
                    Error reference copied to clipboard
                  </span>
                )}
              </div>
              <code className="text-sm font-mono text-muted-foreground">
                {error.digest}
              </code>
              <p className="text-xs text-muted-foreground">
                Include this code when contacting support
              </p>
            </div>
          </div>
        )}
      </Empty>
    </Center>
  );
}
