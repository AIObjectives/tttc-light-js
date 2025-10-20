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
import { EmailPasswordAuthForm } from "@/components/auth/EmailPasswordAuthForm";

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

  useEffect(() => {
    if (isWaitlisted) {
      setShowAccessLimitedModal(true);
    }
  }, [isWaitlisted]);

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
          <Dialog open={showEmailAuth} onOpenChange={setShowEmailAuth}>
            <DialogContent className="gap-y-8">
              <Col gap={2}>
                <DialogTitle>Sign in with Email</DialogTitle>
                <DialogDescription>
                  Sign in or create an account using your email address.
                </DialogDescription>
              </Col>
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
              />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>
              <Button onClick={handleGoogleSignIn} variant="outline">
                Sign in with Google
              </Button>
            </DialogContent>
          </Dialog>

          {/* Access Limited Dialog */}
          <Dialog
            open={showAccessLimitedModal}
            onOpenChange={setShowAccessLimitedModal}
          >
            <DialogClose />
            <DialogContent
              className="gap-y-8"
              overlayProps={{ className: "opacity-40" }}
            >
              <Col gap={2}>
                <DialogTitle>Access is currently limited.</DialogTitle>
                <DialogDescription>
                  We'll let you know as soon as you can start using the tool.
                </DialogDescription>
              </Col>
              <DialogFooter className="justify-self-start">
                <DialogClose asChild>
                  <Button variant={"secondary"}>Close</Button>
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
