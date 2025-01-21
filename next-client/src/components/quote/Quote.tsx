import React from "react";
import { Card, CardContent, Separator } from "../elements";
import { Row } from "../layout";
import Icons from "@src/assets/icons";
import * as schema from "tttc-common/schema";
import { cn } from "@src/lib/utils/shadcn";

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

export function QuoteText({
  text,
  interview,
  className,
  iconClassName,
}: {
  text: string | JSX.Element;
  interview: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <Row gap={3} className="w-full">
      {/* Quote Icon */}
      <div className="self-start flex-shrink-0 py-[5px]">
        <Icons.Quote className={cn("h-4 w-4 fill-black", iconClassName)} />
      </div>
      <div>
        <p className={cn("", className)}>
          {text}
          <span className="text-muted-foreground"> - {interview}</span>
        </p>
      </div>
    </Row>
  );
}

export function Quote({ quote }: { quote: schema.Quote }) {
  return (
    <Row gap={3}>
      <QuoteText text={quote.text} interview={quote.reference.interview} />
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
