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
import { User } from "firebase/auth";

function Navbar() {
  return (
    <Row
      gap={6}
      className="px-6 items-center justify-between h-16 border-b shadow-sm w-screen"
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

        <LoginButton />
      </Row>
    </Row>
  );
}

export default Navbar;
