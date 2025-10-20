import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/elements";
import { Button } from "@/components/elements";
import { signInWithGoogle } from "@/lib/firebase/auth";
import { EmailPasswordAuthForm } from "@/components/auth/EmailPasswordAuthForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Dialog, DialogContent, DialogTitle } from "@/components/elements";
import { logger } from "tttc-common/logger/browser";

const signinModalLogger = logger.child({ module: "signin-modal" });

export function PoorlyFormattedModal({
  isOpen,
  cancelFunc,
  proceedFunc,
}: {
  isOpen: boolean;
  cancelFunc: () => void;
  proceedFunc: () => void;
}) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="w-[329px] gap-6">
        <AlertDialogHeader>
          <AlertDialogTitle>
            We detected a poorly formatted csv. Do you want to proceed?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Please make sure the CSV contains at least two columns named "id"
            and "comment"
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelFunc} asChild>
            <Button variant={"outline"}>Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction onClick={proceedFunc} className="bg-destructive">
            Proceed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const SigninModal = ({ isOpen }: { isOpen: boolean }) => {
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "reset">(
    "signin",
  );

  const handleGoogleSignIn = async () => {
    try {
      signinModalLogger.debug({}, "Google sign in button clicked");
      await signInWithGoogle();
    } catch (error) {
      signinModalLogger.error({ error }, "Google sign in failed");
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="gap-2 p-6 z-[100] max-w-[400px]"
        overlayProps={{ className: "opacity-20 z-[90]" }}
      >
        <DialogTitle className="text-2xl font-semibold tracking-tight">
          {authMode === "reset"
            ? "Password reset"
            : "Sign in or create an account"}
        </DialogTitle>
        {authMode !== "reset" && (
          <div className="flex flex-col gap-2 mt-4">
            <GoogleSignInButton onClick={handleGoogleSignIn} />
            <div className="flex items-center justify-center py-2">
              <span className="text-sm font-medium text-foreground tracking-wide">
                or
              </span>
            </div>
          </div>
        )}
        <EmailPasswordAuthForm
          onSuccess={() => {
            signinModalLogger.info({}, "Email auth successful");
          }}
          onError={(error) => {
            signinModalLogger.error({ error }, "Email auth failed");
          }}
          onModeChange={setAuthMode}
        />
      </DialogContent>
    </Dialog>
  );
};
