"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from "@/components/elements";
import { sendVerificationEmail } from "@/lib/firebase/auth";

interface EmailVerificationPromptProps {
  userEmail: string | null;
}

export function EmailVerificationPrompt({
  userEmail,
}: EmailVerificationPromptProps) {
  const [sending, setSending] = useState(false);

  const handleResendVerification = async () => {
    setSending(true);

    try {
      await sendVerificationEmail();
      console.info(
        "[email-verification] Verification email resent successfully",
        { email: userEmail },
      );
      toast.success("Verification email sent", {
        description: userEmail
          ? `Check your inbox at ${userEmail}`
          : "Check your inbox for a verification link",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to send verification email";
      console.error(
        "[email-verification] Failed to resend verification email",
        { error: err, email: userEmail },
      );
      toast.error("Failed to send email", {
        description: errorMessage,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Alert className="mb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <AlertTitle className="mb-1.5">
              Email verification required
            </AlertTitle>
            <AlertDescription className="text-muted-foreground opacity-90">
              Please verify your email address to create reports. Check for
              verification link
              {userEmail && (
                <>
                  {" "}
                  at <span className="font-medium">{userEmail}</span>
                </>
              )}
              .
            </AlertDescription>
          </div>
        </div>
        <Button
          onClick={handleResendVerification}
          disabled={sending}
          className="shrink-0 self-start sm:self-auto"
        >
          {sending ? "Sending..." : "Resend email"}
        </Button>
      </div>
    </Alert>
  );
}
