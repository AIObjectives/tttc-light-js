"use client";

import Icons from "@/assets/icons";
import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetTrigger,
} from "../../elements";
import { Col, Row } from "@/components/layout";
import Link from "next/link";
import { useState, useEffect } from "react";

export function Headline() {
  return (
    <Link href={"/"} className="h-10 items-center leading-10">
      <Icons.Logo className="inline-block align-middle mr-2" />
      <Icons.TTTC className="hidden sm:inline-block" />
    </Link>
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
      <Button variant={"link"}>
        <p className="font-medium text-foreground">About</p>
      </Button>
    </Link>
  );
}

export function LanguageSelector() {
  return (
    <div>
      <Select value="eng">
        <SelectTrigger className="border-none">
          <span className="font-medium">
            <SelectValue />
          </span>
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
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
    <Link href={"/create"}>
      <Button variant={"secondary"}>
        <Row gap={1} className="hidden sm:block">
          Create a report
        </Row>
        <Row gap={1} className="sm:hidden">
          Create
        </Row>
      </Button>
    </Link>
  );
}

export function MobileHamburgerMenu() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Render a placeholder button during SSR to maintain layout
  if (!isMounted) {
    return (
      <Button variant={"ghost"} className="p-1 visible sm:hidden" disabled>
        <Icons.Menu />
      </Button>
    );
  }

  return (
    <Sheet modal={false} open={isOpen} onOpenChange={(val) => setIsOpen(val)}>
      <SheetTrigger
        className="visible sm:hidden"
        onClick={() => setIsOpen((val) => !val)}
        asChild
      >
        <Button variant={"ghost"} className="p-1">
          {isOpen ? <Icons.X /> : <Icons.Menu />}
        </Button>
      </SheetTrigger>
      <SheetContent side={"bottom"} className="h-[90vh]">
        <Col className="flex h-full justify-between">
          <Col>
            <Link
              onClick={() => setIsOpen(false)}
              href={"/"}
              className="p-2 items-start w-full self-center rounded-[6px]"
            >
              <p>Home</p>
            </Link>
            <Link
              onClick={() => setIsOpen(false)}
              href={"/about"}
              className="p-2 items-start w-full self-center rounded-[6px]"
            >
              <p>About</p>
            </Link>
            <Link
              onClick={() => setIsOpen(false)}
              href={"https://github.com/aIObjectives/tttc-light-js"}
              className="p-2 items-start w-full self-center rounded-[6px]"
            >
              <p>Github</p>
            </Link>
          </Col>
          <Col>
            <Button asChild variant={"secondary"}>
              <Link onClick={() => setIsOpen(false)} href={"/create"}>
                Create a report
              </Link>
            </Button>
          </Col>
        </Col>
      </SheetContent>
    </Sheet>
  );
}
