import { AlertCircle, Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { FormActionError } from "tttc-common/api";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from "@/components/elements";

interface SubmissionErrorBannerProps {
  error: FormActionError;
}

// Server-side error codes where user can't fix the problem and may need to contact support
const SERVER_ERROR_CODES = [
  "INTERNAL_ERROR",
  "PIPELINE_FAILED",
  "STORAGE_ERROR",
  "SERVICE_UNAVAILABLE",
  "DATABASE_ERROR",
];

function isServerError(code: string): boolean {
  return SERVER_ERROR_CODES.includes(code);
}

export function SubmissionErrorBanner({ error }: SubmissionErrorBannerProps) {
  const [copied, setCopied] = useState(false);
  const showErrorReference = isServerError(error.code);

  // Use requestId if available, otherwise fall back to error code
  const errorReference = error.requestId || error.code;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(errorReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const supportEmailHref = `mailto:hello@aiobjectives.org?subject=${encodeURIComponent(`Error report: ${errorReference}`)}&body=${encodeURIComponent(`Hi,\n\nI encountered an error while using Talk to the City.\n\nError code: ${error.code}${error.requestId ? `\nRequest ID: ${error.requestId}` : ""}\nError message: ${error.message}\n\nWhat I was doing when this happened:\n[Please describe what you were trying to do]\n\nThanks`)}`;

  return (
    <Alert variant="destructive" aria-live="assertive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Unable to create report</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>

      {showErrorReference && (
        <div className="mt-3 border-t border-destructive/20 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Error reference:
            </span>
            <code className="text-xs font-mono text-muted-foreground">
              {errorReference}
            </code>
            <button
              type="button"
              onClick={copyToClipboard}
              aria-label="Copy error reference"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors min-h-[44px] px-2 -my-2"
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
          <Button
            asChild
            variant="link"
            className="text-muted-foreground h-auto p-0 mt-2"
          >
            <a href={supportEmailHref}>
              Email support
              <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
            </a>
          </Button>
        </div>
      )}
    </Alert>
  );
}
