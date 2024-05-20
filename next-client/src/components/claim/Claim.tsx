import React from "react";
import { Card, CardContent, Separator } from "../elements";
import Icons from "@src/assets/icons";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { Col, Row } from "../layout";

/**
 * Notes:
 * TODO: Icon size seems off somehow?
 */

function Claim({
  claimNum,
  title,
  quotes,
}: {
  claimNum: number;
  title: string;
  quotes: string[];
}) {
  return (
    <Col gap={3}>
      <ClaimHeader title={title} claimNum={claimNum} />
      <Quotes quotes={quotes} />
    </Col>
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
    <Row gap={0} className="justify-between items-center">
      <h2 className="text-muted-foreground">
        <a id={`${title}`}>{`Claim#${claimNum} ${title}`}</a>
      </h2>
      <CopyLinkButton anchor={title} />
    </Row>
  );
}

/**
 * Single quote - not wrapped in card.
 */
export function Quote({ quote }: { quote: string }) {
  return (
    <Row gap={3}>
      {/* Quote Icon */}
      <div className="min-w-4">
        <Icons.Quote className="fill-foreground h-4 w-4" />
      </div>

      {/* Quote Text */}
      <p className="flex-grow">{quote}</p>

      {/* Chevron */}
      <div className="h-full self-center ">
        <Icons.ChevronRight
          className="text-muted-foreground  self-center"
          size={24}
        />
      </div>
    </Row>
  );
}

/**
 * Creates a column of quotes
 */
export function Quotes({ quotes }: { quotes: string[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <Col gap={3}>
          {quotes.map((quote, i) => (
            <>
              <Quote quote={quote} />
              {i === quotes.length - 1 ? null : <Separator />}
            </>
          ))}
        </Col>
      </CardContent>
    </Card>
  );
}

export default Claim;
