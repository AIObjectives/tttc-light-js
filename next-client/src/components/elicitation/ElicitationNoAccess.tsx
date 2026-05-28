"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Center } from "@/components/layout";
import { useFeatureFlagQuery } from "@/lib/query/useFeatureFlagQuery";
import { useUserQuery } from "@/lib/query/useUserQuery";

export function ElicitationNoAccess() {
  const { user } = useUserQuery();
  const flagContext = useMemo(
    () => (user?.uid ? { userId: user.uid } : undefined),
    [user?.uid],
  );
  const { enabled: redesignEnabled } = useFeatureFlagQuery(
    "website-redesign",
    flagContext,
  );

  if (redesignEnabled) {
    return (
      <div className="max-w-2xl mx-auto px-8 lg:px-28 pt-24 pb-16 flex flex-col items-center gap-3 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          We can help you collect data!
        </h2>
        <p className="text-base text-foreground leading-6">
          We are currently gating access to self-service surveys as part of our
          beta testing. Contact{" "}
          <a
            href="mailto:t3c@objective.is"
            className="text-indigo-600 hover:underline font-medium"
          >
            t3c@objective.is
          </a>{" "}
          or visit our{" "}
          <Link
            href="/workwithus"
            className="text-indigo-600 hover:underline font-medium"
          >
            pricing page
          </Link>{" "}
          if you would like to work with us.
        </p>
      </div>
    );
  }

  return (
    <Center>
      <div className="flex max-w-2xl flex-col items-center gap-3 px-4 text-center">
        <h2>
          We can help you collect data!{" "}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfl9vVzX83F537RrAi1JoqvvCr0ScbBtHOx41dnLX7ynX5djA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-foreground underline underline-offset-4 hover:opacity-80"
          >
            Check it out.
          </a>
        </h2>
        <p className="text-muted-foreground">
          Do you think you should have access to this page? Contact{" "}
          <a
            href="mailto:t3c@objective.is"
            className="underline underline-offset-4 hover:text-primary"
          >
            t3c@objective.is
          </a>{" "}
          for help.
        </p>
      </div>
    </Center>
  );
}
