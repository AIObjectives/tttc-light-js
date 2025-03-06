import React, { useContext, useRef, useState } from "react";
import Icons from "@/assets/icons";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { Col, Row } from "../layout";
import { ClaimNode } from "../report/hooks/useReportState";
import { ReportContext } from "../report/Report";
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
  ScrollArea,
} from "../elements";
import * as schema from "tttc-common/schema";
import { Quote } from "../quote/Quote";
import { getQuotes } from "tttc-common/morphisms";
import useOutsideClick from "@/lib/hooks/useOutsideClick";

function Claim({ claimNode, show }: { claimNode: ClaimNode; show: boolean }) {
  const data = claimNode.data;
  const { title } = data;
  const { useScrollTo } = useContext(ReportContext);
  const scrollRef = useScrollTo(data.id);
  return (
    <div ref={scrollRef} className={`${!show ? "hidden" : ""}`}>
      {show ? (
        <Row gap={3} className="justify-between px-4 sm:px-8 py-1 items-center">
          <ClaimHeader claim={claimNode.data} />
          <Row gap={2}>
            {/* Wrap this in div to prevent sizing issues */}
            <div>
              <CopyLinkButton anchor={title} />
            </div>
            {/* <div>
              <Button variant={"outline"} size={"icon"} className="p-[10px]">
                <Icons.Response className="" />
              </Button>
            </div> */}
          </Row>
        </Row>
      ) : null}
    </div>
  );
}

export function ClaimCard({ claim }: { claim: schema.Claim }) {
  return (
    // <CardContent className="p-4">
    <Col gap={4} className="">
      <ClaimHeader variant="hovercard" claim={claim} />
      <Col className="max-h-[80vh]">
        <ScrollArea className="h-full overflow-auto">
          <Col gap={2}>
            {getQuotes(claim).map((quote, i) => (
              <Quote
                key={quote.id}
                quote={quote}
                gap={2}
                withSeperation={getQuotes(claim).length - 1 !== i}
              />
            ))}
          </Col>
        </ScrollArea>
      </Col>
    </Col>
    // </CardContent>
  );
}

function ShowHoverQuote({
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
          <ClaimCard claim={claim} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}

/**
 * Header for the claim components. Takes the form Claim#N ...
 */
export function ClaimHeader({
  claim,
  variant = "normal",
}: {
  claim: schema.Claim;
  variant?: "normal" | "hovercard";
  // button?:React.ReactNode
}) {
  const { title, number } = claim;
  const quoteNum = getQuotes(claim).length;
  return (
    <Row gap={2} className="items-center">
      <p>
        <span className="font-medium">#{number}</span>
        &ensp;
        <a
          id={`${title}`}
          className={variant === "hovercard" ? "text-muted-foreground" : ""}
        >
          {title}
        </a>
      </p>
      {variant === "normal" ? (
        <>
          <ShowHoverQuote claim={claim} className="hidden sm:block">
            <QuoteIcon num={quoteNum} />
          </ShowHoverQuote>
          <ClaimDrawer claim={claim} className="block sm:hidden">
            <QuoteIcon num={quoteNum} />
          </ClaimDrawer>
        </>
      ) : (
        <></>
      )}
    </Row>
  );
}

export function QuoteIcon({ num }: { num: number }) {
  return (
    <Row
      gap={1}
      className="px-2 py-[2px] border rounded-sm min-w-fit items-center"
    >
      <Icons.QuoteBubble className="fill-primary" />
      <p className="p2 text-primary">{num}</p>
    </Row>
  );
}

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
          <ClaimCard claim={claim} />
        </Col>
      </DrawerContent>
    </Drawer>
  );
}

export default Claim;
