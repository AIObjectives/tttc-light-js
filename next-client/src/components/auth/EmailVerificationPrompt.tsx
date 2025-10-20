"use client";

import { useState } from "react";
import { Button } from "@/components/elements";
import { sendVerificationEmail } from "@/lib/firebase/auth";

interface EmailVerificationPromptProps {
  userEmail: string | null;
}

export function EmailVerificationPrompt({
  userEmail,
}: EmailVerificationPromptProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResendVerification = async () => {
    setSending(true);
    setError(null);

    try {
      await sendVerificationEmail();
      console.info(
        "[email-verification] Verification email resent successfully",
        { email: userEmail },
      );
      setSent(true);
      // Reset the "sent" state after 5 seconds
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to send verification email";
      console.error(
        "[email-verification] Failed to resend verification email",
        { error: err, email: userEmail },
      );
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0" aria-hidden="true">
          <svg
            className="h-5 w-5 text-warning"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-warning-foreground">
            Email Verification Required
          </h3>
          <p className="mt-1 text-sm text-warning-foreground/90">
            Please verify your email address to create reports. Check your inbox
            for a verification link
            {userEmail && (
              <>
                {" "}
                at <span className="font-medium">{userEmail}</span>
              </>
            )}
            .
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendVerification}
              disabled={sending || sent}
              className="bg-background hover:bg-warning/5 min-h-[44px]"
            >
              {sending
                ? "Sending..."
                : sent
                  ? "Email Sent!"
                  : "Resend Verification Email"}
            </Button>
          </div>
          {error && (
            <p
              className="mt-2 text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
