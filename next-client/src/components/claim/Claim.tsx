import React, { useContext } from "react";
import { Card, CardContent, Separator } from "../elements";
import Icons from "@src/assets/icons";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { Col, Row } from "../layout";
import * as schema from "tttc-common/schema";
import { ClaimNode } from "../report/hooks/useReportState";
import { ReportContext } from "../report/Report";

function Claim({
  claimNum,
  claimNode,
  show,
}: {
  claimNum: number;
  claimNode: ClaimNode;
  show: boolean;
}) {
  const data = claimNode.data;
  const { title, quotes } = data;
  const { useScrollTo } = useContext(ReportContext);
  const scrollRef = useScrollTo(data.id);
  return (
    <div ref={scrollRef} className={`${!show ? "hidden" : ""}`}>
      {show ? (
        <CardContent className="py-2 sm:py-2">
          <Col gap={3}>
            <ClaimHeader
              title={title}
              claimNum={claimNum}
              button={<CopyLinkButton anchor={title} />}
            />
            <Quotes quotes={quotes} />
          </Col>
        </CardContent>
      ) : null}
    </div>
  );
}

/**
 * Header for the claim components. Takes the form Claim#N ...
 */
export function ClaimHeader({
  title,
  claimNum,
  button,
  variant = "normal",
}: {
  title: string;
  claimNum: number;
  variant?: "normal" | "inline";
  button?: React.ReactNode;
}) {
  return (
    <Row gap={2} className="justify-between items-start">
      <OuterVariantContainerElement variant={variant}>
        <VariantTextElement variant={variant} className="p-medium">
          Claim#{claimNum + " "}
        </VariantTextElement>
        <InnerVariantContainerElement variant={variant}>
          <VariantTextElement variant={variant} className="text-foreground">
            <a id={`${title}`}>{title}</a>
          </VariantTextElement>
        </InnerVariantContainerElement>
      </OuterVariantContainerElement>
      {button}
    </Row>
  );
}
const VariantTextElement = (
  props: React.HTMLAttributes<HTMLParagraphElement> & {
    variant: "inline" | "normal";
  },
) => (props.variant === "normal" ? <p {...props} /> : <span {...props} />);
const OuterVariantContainerElement = ({
  variant,
  children,
}: React.PropsWithChildren<{ variant: "inline" | "normal" }>) =>
  variant === "inline" ? <p>{children}</p> : <>{children}</>;
const InnerVariantContainerElement = ({
  variant,
  children,
}: React.PropsWithChildren<{ variant: "inline" | "normal" }>) =>
  variant === "inline" ? (
    <>{children}</>
  ) : (
    <div className="flex flex-grow">{children}</div>
  );

// function InlineHeader({text}:{text:string}) {
//   return (
//     <p
//   )
// }

/**
 * Single quote - not wrapped in card.
 */
export function QuoteCard({ quote }: { quote: schema.Quote }) {
  return (
    <CardContent className="p-4 sm:p-4">
      <Quote quote={quote} />
    </CardContent>
  );
}

export function QuoteText({ text }: { text: string }) {
  return (
    <Row gap={3} className="w-full">
      {/* Quote Icon */}
      <div className="self-start flex-shrink-0">
        <Icons.Quote className="h-6 w-4" />
      </div>
      <p className="flex flex-grow text-muted-foreground">{text}</p>
    </Row>
  );
}

export function Quote({ quote }: { quote: schema.Quote }) {
  return (
    <Row gap={3}>
      <QuoteText text={quote.text} />
      {/* Chevron */}
      <div className="h-full self-center flex-shrink-0">
        {/* ! leave this commented out for now */}
        {/* <Icons.ChevronRight className="text-muted-foreground self-center w-6 h-6" /> */}
        <div className="w-6 h-6" />
      </div>
    </Row>
  );
}

/**
 * Creates a column of quotes
 */
export function Quotes({ quotes }: { quotes: schema.Quote[] }) {
  return (
    <Card>
      {quotes.map((quote, i) => (
        <>
          <QuoteCard quote={quote} />
          {i === quotes.length - 1 ? null : <Separator />}
        </>
      ))}
    </Card>
  );
}

export default Claim;
