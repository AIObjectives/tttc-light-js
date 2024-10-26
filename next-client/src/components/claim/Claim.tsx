import React, { useContext, useRef, useState } from "react";
import Icons from "@src/assets/icons";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { Col, Row } from "../layout";
import { ClaimNode } from "../report/hooks/useReportState";
import { ReportContext } from "../report/Report";
import {
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../elements";
import * as schema from "tttc-common/schema";
import { QuoteText } from "../quote/Quote";
import { getNClaims } from "tttc-common/morphisms";
import useOutsideClick from "@src/lib/hooks/useOutsideClick";

function Claim({ claimNode, show }: { claimNode: ClaimNode; show: boolean }) {
  const data = claimNode.data;
  const { title } = data;
  const { useScrollTo } = useContext(ReportContext);
  const scrollRef = useScrollTo(data.id);
  return (
    <div ref={scrollRef} className={`${!show ? "hidden" : ""}`}>
      {show ? (
        <Row gap={3} className="justify-between px-8 py-2 items-center">
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
    <Col gap={4}>
      <ClaimHeader variant="inline" claim={claim} />
      <Col gap={2}>
        {claim.quotes.map((quote) => (
          <QuoteText key={quote.id} text={quote.text} />
        ))}
      </Col>
    </Col>
    // </CardContent>
  );
}

function ShowHoverQuote({
  children,
  claim,
}: React.PropsWithChildren<{ claim: schema.Claim }>) {
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
      <HoverCardTrigger>
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
      <HoverCardContent side="top" avoidCollisions={false}>
        <ClaimCard claim={claim} />
      </HoverCardContent>
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
  variant?: "normal" | "inline";
  // button?:React.ReactNode
}) {
  const { title, number } = claim;
  const quoteNum = claim.quotes.length;
  return (
    <Row gap={2} className="items-center">
      <OuterVariantContainerElement variant={variant}>
        <VariantTextElement variant={variant} className="p-medium">
          Claim#{number + " "}
        </VariantTextElement>
        <InnerVariantContainerElement variant={variant}>
          <VariantTextElement variant={variant} className="text-foreground">
            <a id={`${title}`}>{title}</a>
          </VariantTextElement>
        </InnerVariantContainerElement>
      </OuterVariantContainerElement>
      {variant === "normal" ? (
        <ShowHoverQuote claim={claim}>
          <QuoteIcon num={quoteNum} />
        </ShowHoverQuote>
      ) : (
        <></>
      )}
    </Row>
  );
}

export function QuoteIcon({ num }: { num: number }) {
  return (
    <Row gap={1} className="px-2 border rounded-sm min-w-fit items-center">
      <Icons.QuoteBubble className="fill-primary" />
      <p className="p2 text-primary">{num}</p>
    </Row>
  );
}

// These next few components are used to render claims slightly differently in different places

/**
 * Either paragraph of span based on variant
 */
const VariantTextElement = (
  props: React.HTMLAttributes<HTMLParagraphElement> & {
    variant: "inline" | "normal";
  },
) => (props.variant === "normal" ? <p {...props} /> : <span {...props} />);

/**
 * Wraps children in <p> if inline.
 */
const OuterVariantContainerElement = ({
  variant,
  children,
}: React.PropsWithChildren<{ variant: "inline" | "normal" }>) =>
  variant === "inline" ? <p>{children}</p> : <>{children}</>;

/**
 * Wraps children in div if normal
 */
const InnerVariantContainerElement = ({
  variant,
  children,
}: React.PropsWithChildren<{ variant: "inline" | "normal" }>) =>
  variant === "inline" ? (
    <>{children}</>
  ) : (
    <div className="flex flex-grow">{children}</div>
  );

export default Claim;
