"use client";

import Link from "next/link";
import CreateReport from "@/components/create/CreateReport";
import { useUser } from "@/lib/hooks/getUser";
import { Center } from "@/components/layout";
import { Button, Spinner } from "@/components/elements";
import { signInWithGoogle } from "@/lib/firebase/auth";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/elements/empty";
import { ExternalLink } from "lucide-react";

export default function ReportCreationPage() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

  if (user === null) {
    return (
      <Center>
        <Empty className="border-0 bg-background p-8 rounded-lg max-w-sm">
          <EmptyHeader>
            <EmptyTitle>Sign in required</EmptyTitle>
            <EmptyDescription>
              Please sign in to create a report.
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <div className="flex gap-2">
              <Button onClick={() => signInWithGoogle()} variant="default">
                Sign in with Google
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Homepage</Link>
              </Button>
            </div>

            <Button asChild variant="link" className="text-muted-foreground">
              <a href="mailto:hello@aiobjectives.org">
                Email support
                <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </EmptyContent>
        </Empty>
      </Center>
    );
  }

  return (
    <div className="m-auto max-w-[832px] p-2 mt-4">
      <CreateReport />
    </div>
  );
}
