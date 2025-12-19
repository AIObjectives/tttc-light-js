import { useState } from "react";
import { logger } from "tttc-common/logger/browser";
import { EmailPasswordAuthForm } from "@/components/auth/EmailPasswordAuthForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Dialog, DialogContent, DialogTitle } from "@/components/elements";
import { signInWithGoogle } from "@/lib/firebase/auth";

const signinModalLogger = logger.child({ module: "signin-modal" });

export const SigninModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose?: () => void;
}) => {
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

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setAuthMode("signin"); // Reset mode when closing
      onClose?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
