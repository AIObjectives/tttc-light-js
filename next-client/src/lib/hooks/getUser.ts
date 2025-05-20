"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { getFirebaseAuth } from "../firebase/clientApp";
const auth = getFirebaseAuth();

// Define protected routes for now
const protectedRoutes = ["/my-reports", "/create"];

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle redirect for protected routes
  useEffect(() => {
    if (!loading && !user) {
      const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (isProtectedRoute) {
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

  return user;
}
