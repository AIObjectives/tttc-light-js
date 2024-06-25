import React from "react";
import { Card, CardContent, Separator } from "../elements";
import Icons from "@src/assets/icons";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { Col, Row } from "../layout";
import * as schema from "tttc-common/schema";

function Claim({
  claimNum,
  title,
  quotes,
}: {
  claimNum: number;
  title: string;
  quotes: schema.Quote[];
}) {
  return (
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
  );
}

/**
 * Header for the claim components. Takes the form Claim#N ...
 */
export function ClaimHeader({
  title,
  claimNum,
  button,
}: {
  title: string;
  claimNum: number;
  button?: React.ReactNode;
}) {
  return (
    <Row gap={2} className="justify-between items-start">
      <p className="text-muted-foreground">Claim#{claimNum}</p>
      <div className="flex flex-grow">
        <p className="text-muted-foreground">
          <a id={`${title}`}>{title}</a>
        </p>
      </div>
      {button}
    </Row>
  );
}

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
      <p className="flex flex-grow">{text}</p>
    </Row>
  );
}

export function Quote({ quote }: { quote: schema.Quote }) {
  return (
    <Row gap={3}>
      <QuoteText text={quote.text} />
      {/* Chevron */}
      <div className="h-full self-center flex-shrink-0">
        <Icons.ChevronRight className="text-muted-foreground self-center w-6 h-6" />
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
