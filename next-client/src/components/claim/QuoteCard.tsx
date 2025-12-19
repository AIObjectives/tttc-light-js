import { useContext, useMemo } from "react";
import { getQuotes } from "tttc-common/morphisms";
import type * as schema from "tttc-common/schema";
import { sortQuotesByBridging } from "@/lib/bridging/utils";
import { ScrollArea } from "../elements";
import { Col, Row } from "../layout";
import { Quote } from "../quote/Quote";
import { ReportContext } from "../report/Report";

export function QuoteCard({ claim }: { claim: schema.Claim }) {
  const { addOns, sortByBridging } = useContext(ReportContext);

  // Get quotes and optionally sort by bridging score
  const quotes = useMemo(() => {
    const allQuotes = getQuotes(claim);
    if (sortByBridging) {
      return sortQuotesByBridging(allQuotes, addOns);
    }
    return allQuotes;
  }, [claim, addOns, sortByBridging]);

  return (
    <Col gap={4} data-testid={"quotecard"}>
      <QuoteHeader title={claim.title} number={claim.number} />
      <Col className="max-h-[80vh]">
        <ScrollArea className="h-full overflow-auto">
          <Col gap={2}>
            {quotes.map((quote, i) => (
              <Quote
                key={quote.id}
                quote={quote}
                gap={2}
                withSeperation={quotes.length - 1 !== i}
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
        <span id={`${title}`} className={"text-muted-foreground"}>
          {title}
        </span>
      </p>
    </Row>
  );
}
