import React from "react";
import { Row } from "../layout";
import {
  About,
  CreateReport,
  Headline,
  LanguageSelector,
  RepoGithub,
} from "./components/NavbarButtons";
import LoginButton from "./components/LoginButton";
import { User } from "firebase/auth";

function Navbar({ currentUser }: { currentUser: User | null }) {
  return (
    <Row
      gap={6}
      className="px-6 items-center justify-between h-16 border-b shadow-sm w-screen"
    >
      <Headline />
      <Row gap={2} className="items-center md:justify-self-end hidden sm:flex">
        <RepoGithub />

        <About />

        <LanguageSelector />

        {/* <CreateReport /> */}
        <LoginButton currentUser={currentUser} />
      </Row>
    </Row>
  );
}

export default Navbar;
