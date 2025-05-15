"use client";

import useOutsideClick from "@/lib/hooks/useOutsideClick";
import React, { useRef, useState } from "react";
import * as schema from "tttc-common/schema";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
} from "@/components/elements";
import { Col } from "@/components/layout";
import { QuoteCard } from "./QuoteCard";

/**
 * Shows either a hovercard or drawer with the quote card
 */
export function InteractiveQuoteCard({
  claim,
  QuoteIcon,
}: {
  claim: schema.Claim;
  QuoteIcon: React.ReactNode;
}) {
  return (
    <>
      <HoverQuoteCard claim={claim} className="hidden sm:block">
        {QuoteIcon}
      </HoverQuoteCard>
      <ClaimDrawer claim={claim} className="block sm:hidden">
        {QuoteIcon}
      </ClaimDrawer>
    </>
  );
}

/**
 * This is the hovercard that appears when you hover your cursor over the quote icon
 */
function HoverQuoteCard({
  children,
  claim,
  className,
}: React.PropsWithChildren<{ claim: schema.Claim; className?: string }>) {
  const buttonRef = useRef(null);
  const [state, setState] = useState<boolean>(false);
  const [holdOpen, setHoldOpen] = useState<boolean>(false);

  const onOpenChange = () => setState((curr) => (holdOpen ? holdOpen : !curr));
  useOutsideClick(buttonRef, () => {
    setHoldOpen(false);
    setState(false);
  });

  return (
    <HoverCard open={state} onOpenChange={onOpenChange}>
      <HoverCardTrigger asChild className={className}>
        <Button
          ref={buttonRef}
          variant={"ghost"}
          size={"content"}
          onClick={() => {
            setHoldOpen((curr) => !curr);
            setState(true);
          }}
        >
          {children}
        </Button>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent sideOffset={-1} side="top" avoidCollisions={false}>
          <QuoteCard claim={claim} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}

/**
 * This is the mobile alternative to HoverQuoteCard
 */
function ClaimDrawer({
  children,
  claim,
  className,
}: React.PropsWithChildren<{ claim: schema.Claim; className?: string }>) {
  return (
    <Drawer>
      <DrawerTrigger className={className}>{children}</DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle></DrawerTitle>
        </DrawerHeader>
        <Col className="px-4 pb-4">
          <QuoteCard claim={claim} />
        </Col>
      </DrawerContent>
    </Drawer>
  );
}
