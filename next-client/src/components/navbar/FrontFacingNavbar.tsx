"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/elements";
import { Row } from "@/components/layout";
import {
  FrontFacingHomeLink,
  FrontFacingNavLink,
  RedesignLogo,
  RedesignMobileMenu,
  VerticalDivider,
} from "./components/RedesignNavbarItems";

const FRONT_FACING_MOBILE_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/workwithus", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "https://github.com/aIObjectives/tttc-light-js", label: "Github" },
  { href: "/my-reports", label: "Home" },
];

const LoginButton = dynamic(() => import("./components/LoginButton"), {
  ssr: false,
  loading: () => (
    <Button disabled className="min-w-[80px] h-10 rounded-full">
      ...
    </Button>
  ),
});

export default function FrontFacingNavbar() {
  return (
    <Row
      gap={6}
      className="px-6 items-center justify-between h-16 border-b shadow-xs w-screen z-80 relative bg-white dark:bg-background"
      data-navbar
    >
      <Row gap={2} className="items-center">
        <RedesignMobileMenu links={FRONT_FACING_MOBILE_LINKS} />
        <RedesignLogo />
      </Row>
      <Row gap={7} className="items-center">
        <Row gap={7} className="items-center hidden md:flex">
          <FrontFacingNavLink href="/product" label="Product" />
          <FrontFacingNavLink href="/workwithus" label="Pricing" />
          <FrontFacingNavLink href="/about" label="About" />
          <FrontFacingNavLink
            href="https://github.com/aIObjectives/tttc-light-js"
            label="Github"
          />
          <FrontFacingHomeLink />
        </Row>
        <VerticalDivider className="hidden md:block" />
        <LoginButton hideAppNavItems />
      </Row>
    </Row>
  );
}
