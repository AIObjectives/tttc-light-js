"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/elements";
import { Row } from "@/components/layout";
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

// Studies link is always shown; users without elicitation access see the
// no-access view when they navigate to /studies.
const USER_FACING_MOBILE_LINKS = [
  { href: "/studies", label: "Studies" },
  { href: "/my-reports", label: "Reports" },
];

export default function UserFacingNavbar() {
  return (
    <Row
      gap={6}
      className="px-6 items-center justify-between h-16 border-b shadow-xs w-screen z-80 relative bg-white dark:bg-background"
      data-navbar
    >
      <Row gap={2} className="items-center">
        <RedesignMobileMenu links={USER_FACING_MOBILE_LINKS} />
        <RedesignLogo />
      </Row>
      <Row gap={7} className="items-center">
        <Row gap={3} className="items-center hidden md:flex">
          <StudiesButton />
          <ReportsButton />
        </Row>
        <VerticalDivider className="hidden md:block" />
        <LoginButton hideAppNavItems />
      </Row>
    </Row>
  );
}
