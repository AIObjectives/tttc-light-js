"use client";

import { Button } from "@src/components/elements";
import {
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
} from "@src/lib/firebase/auth";
import { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * @fileoverview LoginButton component + some user session management logic.
 *
 * TODO: There is flickering present
 */

/**
 * Hook for managing a user session
 */
function useUserSession(initialUser: User | null): [boolean, User | null] {
  // The initialUser comes from the server via a server component
  const [user, setUser] = useState(initialUser);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((authUser) => {
      setUser(authUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    onAuthStateChanged((authUser) => {
      if (user === undefined) return;

      if (user?.email !== authUser?.email) {
        router.refresh();
      }
    });
  }, [user]);

  return [authLoading, user];
}

export default function LoginButton({
  currentUser,
}: {
  currentUser: User | null;
}) {
  const [loading, user] = useUserSession(currentUser);
  if (loading) {
    return (
      <div>
        <p>Loading...</p>
      </div>
    );
  }
  return (
    <div>
      {!user ? (
        <Button onClick={signInWithGoogle}>Sign in</Button>
      ) : (
        <Button variant={"secondary"} onClick={signOut}>
          Sign out
        </Button>
      )}
    </div>
  );
}
