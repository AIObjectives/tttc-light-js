"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import CreateReport from "@/components/create/CreateReport";
import { SigninModal } from "@/components/create/components/Modals";
import { Button, Spinner } from "@/components/elements";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/elements/empty";
import { Center } from "@/components/layout";
import { useUserQuery } from "@/lib/query/useUserQuery";

export default function ReportCreationPage() {
  const { user, loading } = useUserQuery();
  const [showSignInModal, setShowSignInModal] = useState(false);

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
        <SigninModal
          isOpen={showSignInModal}
          onClose={() => setShowSignInModal(false)}
        />
        <Empty className="border-0 bg-background p-8 rounded-lg max-w-sm">
          <EmptyHeader>
            <EmptyTitle>Sign in required</EmptyTitle>
            <EmptyDescription>
              Please sign in to create a report.
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowSignInModal(true)}
                variant="default"
              >
                Sign in
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
