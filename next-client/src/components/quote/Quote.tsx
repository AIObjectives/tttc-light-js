import React from "react";
import { Card, CardContent, Separator } from "../elements";
import { Row } from "../layout";
import Icons from "@src/assets/icons";
import * as schema from "tttc-common/schema";

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
