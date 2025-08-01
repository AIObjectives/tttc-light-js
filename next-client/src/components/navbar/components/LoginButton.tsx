"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/elements";
import Link from "next/link";
import { useUser } from "@/lib/hooks/getUser";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { logAuthEvent } from "@/lib/firebase/authEvents";
import { logger } from "tttc-common/logger";

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("");

export default function LoginButton() {
  const { user, loading, error } = useUser();

  const handleSignIn = async () => {
    try {
      logger.debug("Sign in button clicked");
      const result = await signInWithGoogle();
      logger.info("Sign in successful", result.user);

      // Log signin event to server
      await logAuthEvent("signin", result.user);
    } catch (error) {
      logger.error("Sign in failed", error);
    }
  };

  const handleSignOut = async () => {
    try {
      logger.debug("Sign out button clicked", user);

      // Log signout event to server (before actually signing out)
      await logAuthEvent("signout");

      await signOut();
      logger.info("Sign out successful");
    } catch (error) {
      logger.error("Sign out failed", error);
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
          onClick={handleSignIn}
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
        <Button onClick={handleSignIn}>Sign in</Button>
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
