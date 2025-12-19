"use client";

import React, { useRef, useState } from "react";
import type * as schema from "tttc-common/schema";
import {
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
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!isPinned) return;

      const target = event.target as Node;
      const isOutsideTrigger =
        triggerRef.current && !triggerRef.current.contains(target);
      const isOutsideContent =
        contentRef.current && !contentRef.current.contains(target);

      if (isOutsideTrigger && isOutsideContent) {
        setIsPinned(false);
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isPinned]);

  return (
    <HoverCard
      openDelay={0}
      closeDelay={0}
      open={isOpen}
      onOpenChange={(open) => {
        if (!isPinned) {
          setIsOpen(open);
        }
      }}
    >
      <HoverCardTrigger asChild className={className}>
        <div
          ref={triggerRef}
          className="cursor-pointer"
          onClick={() => {
            setIsPinned(true);
            setIsOpen(true);
          }}
        >
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          ref={contentRef}
          sideOffset={-1}
          side="top"
          collisionPadding={16}
        >
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
