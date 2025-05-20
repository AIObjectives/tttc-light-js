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
import {
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
} from "@/lib/firebase/auth";
import { User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/hooks/getUser";

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("");

export default function LoginButton() {
  const user = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <div>
        <Button disabled={true}>...</Button>
      </div>
    );
  }
  return (
    <div>
      {!user ? (
        <Button onClick={signInWithGoogle}>Sign in</Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center">
            <Avatar className="h-10 w-10 self-center">
              <AvatarImage className="h-10 w-10" src={user.photoURL || ""} />
              <AvatarFallback>{getInitials(user.displayName!)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={20}>
            <Link href={"/my-reports"}>
              <DropdownMenuItem>Reports</DropdownMenuItem>
            </Link>
            <DropdownMenuItem onClick={() => signOut()}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
