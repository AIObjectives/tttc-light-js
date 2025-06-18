"use client";

import React from "react";
import { Row } from "../layout";
import {
  About,
  CreateReport,
  Headline,
  LanguageSelector,
  MobileHamburgerMenu,
  RepoGithub,
} from "./components/NavbarButtons";
import LoginButton from "./components/LoginButton";
import { Button } from "../elements";

function Navbar() {
  return (
    <Row
      gap={6}
      className="px-6 items-center justify-between h-16 border-b shadow-sm w-screen z-[80] relative bg-white dark:bg-background"
      data-navbar
    >
      <Row className="items-center" gap={2}>
        <MobileHamburgerMenu />
        <Headline />
      </Row>
      <Row
        gap={2}
        className="items-center content-center md:justify-self-end sm:flex"
      >
        <Row
          gap={2}
          className="items-center content-center md:justify-self-end hidden sm:flex"
        >
          <RepoGithub />
        </Row>

        <About />
        <CreateReport />
        <Button variant={"secondary"} asChild>
          <a
            target="_blank"
            href="https://forms.monday.com/forms/8bf6010faeea207850d0d9c218b9331b?r=use1"
          >
            Join the waitlist
          </a>
        </Button>
        <LoginButton />
      </Row>
    </Row>
  );
}

export default Navbar;
