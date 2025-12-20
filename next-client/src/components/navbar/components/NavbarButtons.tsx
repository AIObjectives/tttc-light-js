"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icons from "@/assets/icons";
import { Col, Row } from "@/components/layout";
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
  SheetTitle,
  SheetTrigger,
} from "../../elements";

export function Headline() {
  return (
    <Link href={"/"} className="h-10 items-center leading-10">
      <Icons.Logo className="inline-block align-middle mr-2" />
      <Icons.TTTC className="inline-block" />
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
      <Button
        variant={"ghost"}
        className="size-10 visible md:hidden"
        disabled
        aria-label="Open menu"
      >
        <Icons.Menu />
      </Button>
    );
  }

  return (
    <Sheet modal={false} open={isOpen} onOpenChange={(val) => setIsOpen(val)}>
      <SheetTrigger
        className="visible md:hidden"
        onClick={() => setIsOpen((val) => !val)}
        asChild
      >
        <Button
          variant={"ghost"}
          className="size-10"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <Icons.X /> : <Icons.Menu />}
        </Button>
      </SheetTrigger>
      <SheetContent
        side={"bottom"}
        className="h-[90vh]"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <Col className="flex h-full justify-between">
          <Col>
            <Link
              onClick={() => setIsOpen(false)}
              href={"/"}
              className="p-3 min-h-[44px] flex items-center w-full self-center rounded-[6px]"
            >
              <p>Home</p>
            </Link>
            <Link
              onClick={() => setIsOpen(false)}
              href={"/about"}
              className="p-3 min-h-[44px] flex items-center w-full self-center rounded-[6px]"
            >
              <p>About</p>
            </Link>
            <Link
              onClick={() => setIsOpen(false)}
              href={"https://github.com/aIObjectives/tttc-light-js"}
              className="p-3 min-h-[44px] flex items-center w-full self-center rounded-[6px]"
            >
              <p>Github</p>
            </Link>
          </Col>
          <Col gap={2}>
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
