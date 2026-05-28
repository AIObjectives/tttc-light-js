"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Button } from "@/components/elements";
import { Row } from "@/components/layout";
import { useFeatureFlagQuery } from "@/lib/query/useFeatureFlagQuery";
import { useUserQuery } from "@/lib/query/useUserQuery";
import {
  RedesignLogo,
  RedesignMobileMenu,
  ReportsButton,
  StudiesButton,
  VerticalDivider,
} from "./components/RedesignNavbarItems";

const LoginButton = dynamic(() => import("./components/LoginButton"), {
  ssr: false,
  loading: () => (
    <Button disabled className="min-w-[80px] h-10 rounded-full">
      ...
    </Button>
  ),
});

export default function UserFacingNavbar() {
  const { user } = useUserQuery();
  // Match the same study-access gating the old dropdown used so visibility
  // doesn't change — we're only moving the link, not the gate.
  const flagContext = useMemo(
    () => (user?.uid ? { userId: user.uid } : undefined),
    [user?.uid],
  );
  const { enabled: studiesEnabled } = useFeatureFlagQuery(
    "elicitation_enabled",
    flagContext,
  );

  const mobileLinks = [
    ...(studiesEnabled ? [{ href: "/studies", label: "Studies" }] : []),
    { href: "/my-reports", label: "Reports" },
  ];

  return (
    <Row
      gap={6}
      className="px-6 items-center justify-between h-16 border-b shadow-xs w-screen z-80 relative bg-white dark:bg-background"
      data-navbar
    >
      <Row gap={2} className="items-center">
        <RedesignMobileMenu links={mobileLinks} />
        <RedesignLogo />
      </Row>
      <Row gap={7} className="items-center">
        <Row gap={3} className="items-center hidden md:flex">
          {studiesEnabled && <StudiesButton />}
          <ReportsButton />
        </Row>
        <VerticalDivider />
        <LoginButton hideAppNavItems />
      </Row>
    </Row>
  );
}
