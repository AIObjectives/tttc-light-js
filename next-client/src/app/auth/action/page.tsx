"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/clientApp";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { Button, Card } from "@/components/elements";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";
import { logger } from "tttc-common/logger/browser";

const actionLogger = logger.child({ module: "auth-action" });

type ActionMode = "resetPassword" | "verifyEmail" | "recoverEmail" | null;
type ActionStatus = "loading" | "success" | "error";

function AuthActionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<ActionStatus>("loading");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<ActionMode>(null);

  const oobCode = searchParams.get("oobCode");
  const continueUrl = searchParams.get("continueUrl");
  const modeParam = searchParams.get("mode") as ActionMode;

  useEffect(() => {
    const handleAction = async () => {
      if (!oobCode) {
        actionLogger.error({}, "No action code provided");
        setStatus("error");
        setMessage("Invalid action link. The link may be malformed.");
        return;
      }

      setMode(modeParam);
      const auth = getFirebaseAuth();

      try {
        switch (modeParam) {
          case "resetPassword":
            // Don't handle here - let the PasswordResetForm component handle it
            setStatus("success");
            break;

          case "verifyEmail":
            actionLogger.info({}, "Verifying email");
            await applyActionCode(auth, oobCode);
            actionLogger.info({}, "Email verified successfully");
            setStatus("success");
            setMessage(
              "Email verified successfully! You can now create reports.",
            );
            break;

          case "recoverEmail":
            actionLogger.info({}, "Recovering email");
            const info = await checkActionCode(auth, oobCode);
            await applyActionCode(auth, oobCode);
            actionLogger.info(
              { email: info.data.email },
              "Email recovered successfully",
            );
            setStatus("success");
            setMessage(
              `Email recovered successfully! Your email has been restored to ${info.data.email}.`,
            );
            break;

          default:
            actionLogger.error({ mode: modeParam }, "Invalid action mode");
            setStatus("error");
            setMessage("Invalid action type");
        }
      } catch (error) {
        actionLogger.error({ error, mode: modeParam }, "Action failed");
        setStatus("error");
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Action failed. The link may be expired or already used.";
        setMessage(errorMessage);
      }
    };

    handleAction();
  }, [oobCode, modeParam]);

  const handleContinue = () => {
    if (continueUrl) {
      window.location.href = continueUrl;
    } else {
      router.push("/");
    }
  };

  const renderContent = () => {
    if (status === "loading" && mode !== "resetPassword") {
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="text-muted-foreground">Processing your request...</p>
        </div>
      );
    }

    if (mode === "resetPassword" && oobCode) {
      return (
        <>
          <h1 className="text-2xl font-bold">Reset Your Password</h1>
          <p className="text-muted-foreground">
            Enter your new password below.
          </p>
          <PasswordResetForm
            actionCode={oobCode}
            onSuccess={() => {
              setStatus("success");
              setMessage(
                "Password reset successfully! You can now sign in with your new password.",
              );
            }}
            onError={(error) => {
              setStatus("error");
              setMessage(error);
            }}
          />
        </>
      );
    }

    if (status === "success") {
      return (
        <>
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center">Success!</h1>
          <p className="text-center text-muted-foreground">{message}</p>
          <Button onClick={handleContinue} className="w-full">
            Continue to App
          </Button>
        </>
      );
    }

    if (status === "error") {
      return (
        <>
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center">Action Failed</h1>
          <p className="text-center text-destructive">{message}</p>
          <Button onClick={handleContinue} variant="outline" className="w-full">
            Go to Home
          </Button>
        </>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col gap-6">{renderContent()}</div>
      </Card>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      }
    >
      <AuthActionContent />
    </Suspense>
  );
}
