"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { type ReactNode, useEffect } from "react";
import {
  cleanupAuthSubscription,
  initAuthSubscription,
} from "./authSubscription";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default staleTime of 5 minutes - data is fresh for this period
        staleTime: 5 * 60 * 1000,
        // Cache data for 30 minutes before garbage collection
        gcTime: 30 * 60 * 1000,
        // Retry failed requests 3 times with exponential backoff
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
        // Don't refetch on window focus for better UX on slow networks
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Singleton pattern for SSR - ensures same client across renders on server
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: reuse client if we already have one
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  // Initialize auth subscription when provider mounts
  useEffect(() => {
    initAuthSubscription(queryClient);
    return () => cleanupAuthSubscription();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
