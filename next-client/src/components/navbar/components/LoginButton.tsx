"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logger } from "tttc-common/logger/browser";
import { EmailPasswordAuthForm } from "@/components/auth/EmailPasswordAuthForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/elements";
import { ProfileSetupModal } from "@/components/profile/ProfileSetupModal";
import { AUTH_ACTIONS } from "@/lib/constants/auth";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { logAuthEvent } from "@/lib/firebase/authEvents";
import { useUserQuery } from "@/lib/query/useUserQuery";

const loginLogger = logger.child({ module: "login-button" });

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("");

/**
 * Check if the user just signed up (vs. signed in to existing account)
 * New signups have matching creation and last sign-in times
 */
const isNewSignup = (user: {
  metadata: { creationTime?: string; lastSignInTime?: string };
}): boolean => {
  if (!user.metadata.creationTime || !user.metadata.lastSignInTime) {
    return false;
  }
  return user.metadata.creationTime === user.metadata.lastSignInTime;
};

/**
 * Profile setup modal skip tracking
 * - Shows on first signup
 * - If skipped, shows again after 7 days
 * - Max 3 skips, then stops showing
 */
const PROFILE_SETUP_KEY = "profileSetupSkips";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SKIPS = 3;

interface ProfileSetupSkipState {
  skipCount: number;
  lastSkippedAt: number;
  completed: boolean;
}

const getProfileSetupState = (): ProfileSetupSkipState => {
  try {
    const stored = localStorage.getItem(PROFILE_SETUP_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { skipCount: 0, lastSkippedAt: 0, completed: false };
};

const shouldShowProfileSetup = (): boolean => {
  const state = getProfileSetupState();

  // Already completed - never show again
  if (state.completed) return false;

  // Max skips reached - stop showing
  if (state.skipCount >= MAX_SKIPS) return false;

  // First time - show it
  if (state.skipCount === 0) return true;

  // Check if 7 days have passed since last skip
  const timeSinceSkip = Date.now() - state.lastSkippedAt;
  return timeSinceSkip >= SEVEN_DAYS_MS;
};

const recordProfileSetupSkip = () => {
  const state = getProfileSetupState();
  const updated: ProfileSetupSkipState = {
    ...state,
    skipCount: state.skipCount + 1,
    lastSkippedAt: Date.now(),
  };
  localStorage.setItem(PROFILE_SETUP_KEY, JSON.stringify(updated));
};

const recordProfileSetupComplete = () => {
  const state = getProfileSetupState();
  const updated: ProfileSetupSkipState = {
    ...state,
    completed: true,
  };
  localStorage.setItem(PROFILE_SETUP_KEY, JSON.stringify(updated));
};

export default function LoginButton() {
  const { user, loading, error } = useUserQuery();
  const [showEmailAuth, setShowEmailAuth] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "reset">(
    "signin",
  );
  const [showProfileSetup, setShowProfileSetup] = useState<boolean>(false);
  const searchParams = useSearchParams();

  // Ref to prevent race condition in strict mode where effect runs twice
  // before sessionStorage.setItem completes
  const hasShownProfileModal = useRef(false);

  // Show profile setup modal based on skip tracking
  // - First time: show immediately after signup
  // - If skipped: show again after 7 days, up to 3 times
  useEffect(() => {
    if (user && !loading && !hasShownProfileModal.current) {
      // Use sessionStorage to prevent showing multiple times in same session
      const shownThisSession = sessionStorage.getItem(
        "profileSetupShownThisSession",
      );
      if (shownThisSession) return;

      if (shouldShowProfileSetup()) {
        hasShownProfileModal.current = true;
        sessionStorage.setItem("profileSetupShownThisSession", "true");
        setShowProfileSetup(true);
      }
    }
  }, [user, loading]);

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
      // Initiates redirect to Google sign-in page
      // The redirect result will be handled by RedirectHandler component
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
              className="gap-2 p-6 z-100 max-w-[400px]"
              overlayProps={{ className: "opacity-20 z-90" }}
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

                  // Show profile setup modal for new signups
                  if (isNewSignup(result.user)) {
                    setShowProfileSetup(true);
                  }
                }}
                onError={(error) => {
                  loginLogger.error({ error }, "Email auth failed");
                }}
                onModeChange={setAuthMode}
              />
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

      {/* Profile Setup Modal - shown for new signups and periodically if skipped */}
      <ProfileSetupModal
        isOpen={showProfileSetup}
        onClose={() => {
          recordProfileSetupSkip();
          setShowProfileSetup(false);
        }}
        onComplete={(isFullyComplete) => {
          if (isFullyComplete) {
            recordProfileSetupComplete();
            loginLogger.info({}, "Profile setup completed");
          } else {
            // Partial submission counts as a skip - reprompt later
            recordProfileSetupSkip();
            loginLogger.info({}, "Profile partially completed, will reprompt");
          }
          setShowProfileSetup(false);
        }}
      />
    </div>
  );
}
