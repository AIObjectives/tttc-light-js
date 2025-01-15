import React, { useState } from "react";
import { Card, CardContent, Separator } from "../elements";
import { Col, Row } from "../layout";
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
  className,
  iconClassName,
}: {
  text: string | JSX.Element;
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
        <p className={cn("", className)}>{text}</p>
      </div>
    </Row>
  );
}

export function Quote({ quote }: { quote: schema.Quote }) {
  return (
    <Col gap={4}>
      {quote.reference.data[0] === "video" ? (
        <Col gap={4}>
          <Video src={quote.reference.data[1].link} />
        </Col>
      ) : null}
      <QuoteText text={quote.text} />
    </Col>
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

const Video = ({ src }: { src: string }) => {
  return (
    <Col className="px-4">
      <iframe src={src} width={"100%"} className="aspect-video" />
    </Col>
  );
};
