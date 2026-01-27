"use client";

import dynamic from "next/dynamic";
import { Button } from "../elements";
import { Row } from "../layout";
import {
  About,
  CreateReport,
  Headline,
  MobileHamburgerMenu,
  RepoGithub,
} from "./components/NavbarButtons";

// Lazy-load LoginButton to defer Firebase SDK loading
// This reduces initial bundle size for anonymous visitors (e.g., landing page)
const LoginButton = dynamic(() => import("./components/LoginButton"), {
  ssr: false,
  loading: () => (
    <div>
      <Button disabled className="min-w-[80px]">
        ...
      </Button>
    </div>
  ),
});

function Navbar() {
  return (
    <Row
      gap={6}
      className="px-6 items-center justify-between h-16 border-b shadow-xs w-screen z-80 relative bg-white dark:bg-background"
      data-navbar
    >
      <Row className="items-center" gap={2}>
        <MobileHamburgerMenu />
        <Headline />
      </Row>
      <Row
        gap={2}
        className="items-center content-center md:justify-self-end md:flex"
      >
        <Row
          gap={2}
          className="items-center content-center md:justify-self-end hidden md:flex"
        >
          <RepoGithub />
          <About />
          <CreateReport />
        </Row>
        <LoginButton />
      </Row>
    </Row>
  );
}

export default Navbar;
