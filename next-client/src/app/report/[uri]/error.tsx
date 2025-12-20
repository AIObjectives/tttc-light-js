"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/elements/button/Button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/elements/empty";
import { Center } from "@/components/layout/Center";

export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Report error:", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  const supportEmailHref = error.digest
    ? `mailto:hello@aiobjectives.org?subject=${encodeURIComponent(`Report error: ${error.digest}`)}&body=${encodeURIComponent(`Hi,\n\nI encountered an error loading a report.\n\nError reference: ${error.digest}\n\nReport URL: ${typeof window !== "undefined" ? window.location.href : ""}\n\nThanks`)}`
    : "mailto:hello@aiobjectives.org";

  return (
    <Center>
      <Empty className="border-0 bg-background p-8 rounded-lg max-w-sm">
        <EmptyHeader>
          <EmptyTitle>Unable to load report</EmptyTitle>
          <EmptyDescription>
            We couldn't load this report. It may still be generating, or there
            might be a temporary issue with our service.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/my-reports">My reports</Link>
            </Button>
          </div>

          <Button asChild variant="link" className="text-muted-foreground">
            <a href={supportEmailHref}>
              Email support
              <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>

          {error.digest && (
            <span className="font-mono text-xs text-muted-foreground">
              ref: {error.digest}
            </span>
          )}
        </EmptyContent>
      </Empty>
    </Center>
  );
}
