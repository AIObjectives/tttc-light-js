import React from "react";
import * as schema from "tttc-common/schema";
import { Col, Row } from "../layout";
import { ScrollArea } from "../elements";
import { getQuotes } from "tttc-common/morphisms";
import { Quote } from "../quote/Quote";

export function QuoteCard({ claim }: { claim: schema.Claim }) {
  return (
    <Col gap={4}>
      <QuoteHeader title={claim.title} number={claim.number} />
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
  );
}

function QuoteHeader({ number, title }: { number: number; title: string }) {
  return (
    <Row gap={2} className="items-center">
      <p>
        <span className="font-medium">#{number}</span>
        &ensp;
        <a id={`${title}`} className={"text-muted-foreground"}>
          {title}
        </a>
      </p>
    </Row>
  );
}
