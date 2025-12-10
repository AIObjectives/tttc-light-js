"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/elements";
import Link from "next/link";
import { useUser } from "@/lib/hooks/getUser";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { logAuthEvent } from "@/lib/firebase/authEvents";
import { logger } from "tttc-common/logger/browser";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { EmailPasswordAuthForm } from "@/components/auth/EmailPasswordAuthForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AUTH_ACTIONS } from "@/lib/constants/auth";

const loginLogger = logger.child({ module: "login-button" });
import { Col } from "@/components/layout";

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("");

export default function LoginButton() {
  const { user, loading, error, isWaitlisted } = useUser();
  const [showAccessLimitedModal, setShowAccessLimitedModal] =
    useState<boolean>(false);
  const [showEmailAuth, setShowEmailAuth] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "reset">(
    "signin",
  );
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isWaitlisted) {
      setShowAccessLimitedModal(true);
    }
  }, [isWaitlisted]);

  // Auto-open sign-in modal if action=signin query param is present (e.g., after password reset)
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === AUTH_ACTIONS.SIGNIN && !user) {
      setShowEmailAuth(true);
      // Clean up URL by removing the query parameter without triggering navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams, user]);

  const handleGoogleSignIn = async () => {
    try {
      loginLogger.debug({}, "Google sign in button clicked");
      // Initiates redirect to Google sign-in page.
      // After user signs in, Google redirects back to the app.
      // The useUser hook detects the sign-in via onAuthStateChanged.
      await signInWithGoogle();
      // Note: Code after this won't execute as browser redirects to Google
    } catch (error) {
      loginLogger.error({ error }, "Google sign in redirect failed");
    }
  };

  const handleSignInClick = () => {
    setShowEmailAuth(true);
  };

  const handleSignOut = async () => {
    try {
      loginLogger.debug(
        {
          uid: user?.uid,
          email: user?.email,
          displayName: user?.displayName,
        },
        "Sign out button clicked",
      );

      // Log signout event to server (before actually signing out)
      if (!user) {
        throw new Error("Sign out attempted with no user");
      }

      await logAuthEvent("signout", user);

      await signOut();
      loginLogger.info({}, "Sign out successful");
    } catch (error) {
      loginLogger.error({ error }, "Sign out failed");
    }
  };

  if (loading) {
    return (
      <div>
        <Button disabled={true}>Loading...</Button>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Button
          onClick={handleSignInClick}
          variant="destructive"
          title={`Auth Error: ${error}`}
        >
          Retry Login
        </Button>
      </div>
    );
  }
  return (
    <div>
      {!user ? (
        <>
          <Button onClick={handleSignInClick}>Sign in</Button>

          {/* Email/Password Auth Dialog */}
          <Dialog
            open={showEmailAuth}
            onOpenChange={(open) => {
              setShowEmailAuth(open);
              if (!open) setAuthMode("signin"); // Reset mode when closing
            }}
          >
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
                onSuccess={async (result) => {
                  loginLogger.info(
                    {
                      uid: result.user.uid,
                      email: result.user.email,
                    },
                    "Email auth successful",
                  );
                  await logAuthEvent("signin", result.user);
                  setShowEmailAuth(false);
                }}
                onError={(error) => {
                  loginLogger.error({ error }, "Email auth failed");
                }}
                onModeChange={setAuthMode}
              />
            </DialogContent>
          </Dialog>

          {/* Access Limited Dialog */}
          <Dialog
            open={showAccessLimitedModal}
            onOpenChange={setShowAccessLimitedModal}
          >
            <DialogClose />
            <DialogContent
              className="gap-y-8 z-[100]"
              overlayProps={{ className: "opacity-20 z-[90]" }}
            >
              <Col gap={2}>
                <DialogTitle>Access is currently limited.</DialogTitle>
                <DialogDescription>
                  Join the waitlist and we'll let you know as soon as you can
                  start using the tool.
                </DialogDescription>
              </Col>
              <DialogFooter className="justify-self-start flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <a
                    href="https://forms.monday.com/forms/8bf6010faeea207850d0d9c218b9331b?r=use1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join the waitlist
                  </a>
                </Button>
                <DialogClose asChild>
                  <Button variant={"outline"}>Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center">
            <Avatar className="h-10 w-10 self-center">
              <AvatarImage className="h-10 w-10" src={user.photoURL || ""} />
              <AvatarFallback>
                {user?.displayName ? getInitials(user.displayName) : "??"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={20}>
            <Link href={"/my-reports"}>
              <DropdownMenuItem>Reports</DropdownMenuItem>
            </Link>
            <DropdownMenuItem onClick={handleSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
