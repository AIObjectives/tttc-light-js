"use client";

import Icons from "@src/assets/icons";
import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "../../elements";
import { Row } from "@src/components/layout";
import Link from "next/link";

export function Headline() {
  return (
    <Row gap={6} className="h-10 items-center">
      {/* hamburger */}
      <Button variant={"ghost"} size={"icon"} className="p-2 sm:hidden">
        <Icons.Menu size={24} />
      </Button>
      {/* <Separator orientation="vertical" className="h-full hidden sm:block" /> */}
      <h3 className="hidden sm:block">Talk to the City</h3>
    </Row>
  );
}

export function RepoGithub() {
  return (
    <Link href={"https://github.com/aIObjectives/tttc-light-js"}>
      <Icons.Github />
    </Link>
  );
}

export function About() {
  return (
    <Link href={"/about"}>
      <Button variant={"link"}>About</Button>
    </Link>
  );
}

export function LanguageSelector() {
  return (
    <div>
      <Select value="eng">
        <SelectTrigger className="border-none">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup className="w-9">
            <SelectItem value="esp">Spanish</SelectItem>
            <SelectItem value="eng">English</SelectItem>
            <SelectItem value="chn">Chinese</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function CreateReport() {
  return (
    <Link href={"/"}>
      <Button>
        <Row gap={1}>
          <Icons.Plus className="self-center" size={16} />
          Create report
        </Row>
      </Button>
    </Link>
  );
}
