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
        <ClaimHeader title={title} claimNum={claimNum} />
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
}: {
  title: string;
  claimNum: number;
}) {
  return (
    <Row gap={2} className="justify-between items-start">
      <p className="text-muted-foreground">Claim#{claimNum}</p>
      <div className="flex flex-grow">
        <p className="text-muted-foreground">
          <a id={`${title}`}>{title}</a>
        </p>
      </div>
      <CopyLinkButton anchor={title} />
    </Row>
  );
}

/**
 * Single quote - not wrapped in card.
 */
export function Quote({ quote }: { quote: schema.Quote }) {
  return (
    <CardContent className="p-4 sm:p-4">
      <Row gap={3}>
        {/* Quote Icon */}
        <div className="self-start">
          <Icons.Quote className="h-6 w-4" />
        </div>

        {/* Quote Text */}
        <p className="flex-grow">{quote.text}</p>

        {/* Chevron */}
        <div className="h-full self-center ">
          <Icons.ChevronRight className="text-muted-foreground self-center w-6 h-6" />
        </div>
      </Row>
    </CardContent>
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
          <Quote quote={quote} />
          {i === quotes.length - 1 ? null : <Separator />}
        </>
      ))}
    </Card>
  );
}

export default Claim;
