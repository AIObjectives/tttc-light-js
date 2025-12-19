"use client";

import { applyActionCode, checkActionCode } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";
import { Button, Card, Spinner } from "@/components/elements";
import { ACTION_MODES, AUTH_ACTIONS } from "@/lib/constants/auth";
import { getFirebaseAuth } from "@/lib/firebase/clientApp";

type ActionMode = "resetPassword" | "verifyEmail" | "recoverEmail" | null;
type ActionStatus = "loading" | "success" | "error";

/**
 * Status icon for success/error states
 */
function StatusIcon({ variant }: { variant: "success" | "error" }) {
  const isSuccess = variant === "success";
  const bgColor = isSuccess ? "bg-primary/10" : "bg-destructive/10";
  const iconColor = isSuccess ? "text-primary" : "text-destructive";
  const path = isSuccess
    ? "M5 13l4 4L19 7" // Checkmark
    : "M6 18L18 6M6 6l12 12"; // X mark

  return (
    <div
      className={`flex items-center justify-center w-16 h-16 rounded-full ${bgColor} mx-auto`}
      aria-hidden="true"
    >
      <svg
        className={`w-8 h-8 ${iconColor}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={path}
        />
      </svg>
    </div>
  );
}

function AuthActionContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ActionStatus>("loading");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<ActionMode>(null);
  const hasProcessedRef = useRef(false);

  const oobCode = searchParams.get("oobCode");
  const modeParam = searchParams.get("mode") as ActionMode;

  // Memoize callbacks to prevent PasswordResetForm useEffect from re-running unnecessarily
  const handlePasswordResetSuccess = useCallback(() => {
    setStatus("success");
    setMessage(
      "Your password has been updated. Click below to sign in with your new password.",
    );
  }, []);

  const handlePasswordResetError = useCallback((error: string) => {
    setStatus("error");
    setMessage(error);
  }, []);

  useEffect(() => {
    const handleAction = async () => {
      // Log component mount and all URL parameters
      console.info("[auth-action] Component mounted/effect triggered", {
        oobCode: oobCode ? `${oobCode.substring(0, 20)}...` : null,
        mode: modeParam,
        hasProcessed: hasProcessedRef.current,
        currentStatus: status,
        url: window.location.href,
      });

      // Prevent double processing (React StrictMode, re-renders, etc.)
      if (hasProcessedRef.current) {
        console.warn(
          "[auth-action] Already processed, skipping to prevent double-processing",
          {
            hasProcessedRef: hasProcessedRef.current,
            currentStatus: status,
          },
        );
        return;
      }

      // Don't process if we're already in a final state (prevents error on navigation)
      if (status === "success" || status === "error") {
        console.debug("[auth-action] Already in final state, skipping", {
          currentStatus: status,
        });
        return;
      }

      if (!oobCode) {
        console.error(
          "[auth-action] No action code provided - URL missing oobCode parameter",
          {
            mode: modeParam,
            searchParamsKeys: Array.from(searchParams.keys()),
            fullUrl: window.location.href,
            currentStatus: status,
          },
        );
        setStatus("error");
        setMessage("Invalid action link. The link may be malformed.");
        return;
      }

      // Mark as processed before async operations
      console.debug("[auth-action] Marking as processed, beginning action", {
        mode: modeParam,
      });
      hasProcessedRef.current = true;

      setMode(modeParam);
      const auth = getFirebaseAuth();

      try {
        switch (modeParam) {
          case ACTION_MODES.RESET_PASSWORD:
            // Don't handle here - let the PasswordResetForm component handle it
            // Status remains "loading" until PasswordResetForm calls onSuccess/onError
            break;

          case ACTION_MODES.VERIFY_EMAIL:
            console.info("[auth-action] Verifying email");
            await applyActionCode(auth, oobCode);
            console.info("[auth-action] Email verified successfully");
            setStatus("success");
            setMessage(
              "Email verified successfully! You can now sign in to your account.",
            );
            break;

          case ACTION_MODES.RECOVER_EMAIL: {
            console.info("[auth-action] Recovering email");
            const info = await checkActionCode(auth, oobCode);
            await applyActionCode(auth, oobCode);
            console.info("[auth-action] Email recovered successfully", {
              email: info.data.email,
            });
            setStatus("success");
            setMessage(
              `Email recovered successfully! Your email has been restored to ${info.data.email}.`,
            );
            break;
          }

          default:
            console.error("[auth-action] Invalid action mode", {
              mode: modeParam,
            });
            setStatus("error");
            setMessage("Invalid action type");
        }
      } catch (error) {
        console.error("[auth-action] Action failed", {
          error,
          mode: modeParam,
        });
        setStatus("error");
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Action failed. The link may be expired or already used.";
        setMessage(errorMessage);
      }
    };

    handleAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- status intentionally excluded to prevent re-triggering on status changes
  }, [oobCode, modeParam]);

  const handleContinue = () => {
    console.info("[auth-action] Continue button clicked", {
      status,
      mode,
    });

    // Always navigate to home page after successful action
    // Use window.location.href to force full page reload and prevent effect re-triggering
    // For password reset, add query param to auto-open sign-in modal
    const destination =
      mode === ACTION_MODES.RESET_PASSWORD
        ? `/?action=${AUTH_ACTIONS.SIGNIN}`
        : "/";
    console.debug("[auth-action] Navigating to home page", { destination });
    window.location.href = destination;
  };

  const renderContent = () => {
    // Loading state (non-password-reset)
    if (status === "loading" && mode !== ACTION_MODES.RESET_PASSWORD) {
      return (
        <div
          className="flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <Spinner className="size-12" />
          <p className="text-muted-foreground">Processing your request...</p>
        </div>
      );
    }

    // Password reset form
    if (
      mode === ACTION_MODES.RESET_PASSWORD &&
      oobCode &&
      status === "loading"
    ) {
      return (
        <>
          <h1 className="text-2xl font-bold">Reset Your Password</h1>
          <p className="text-muted-foreground">
            Enter your new password below.
          </p>
          <PasswordResetForm
            actionCode={oobCode}
            onSuccess={handlePasswordResetSuccess}
            onError={handlePasswordResetError}
          />
        </>
      );
    }

    // Success state
    if (status === "success") {
      const isPasswordReset = mode === ACTION_MODES.RESET_PASSWORD;
      return (
        <>
          <StatusIcon variant="success" />
          <h1 className="text-2xl font-bold text-center">Success!</h1>
          <p className="text-center text-muted-foreground">{message}</p>
          <Button onClick={handleContinue} className="w-full">
            {isPasswordReset ? "Sign In Now" : "Continue to App"}
          </Button>
        </>
      );
    }

    // Error state
    if (status === "error") {
      return (
        <>
          <StatusIcon variant="error" />
          <h1 className="text-2xl font-bold text-center">Action Failed</h1>
          <p className="text-center text-destructive" role="alert">
            {message}
          </p>
          <Button onClick={handleContinue} variant="outline" className="w-full">
            Go to Home
          </Button>
        </>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted">
      <Card className="w-full max-w-md p-4 sm:p-6 md:p-8">
        <div className="flex flex-col gap-6">{renderContent()}</div>
      </Card>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label="Loading authentication action"
        >
          <Spinner className="size-12" />
        </div>
      }
    >
      <AuthActionContent />
    </Suspense>
  );
}
