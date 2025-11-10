import React, { useContext } from "react";
import { Card, CardContent, Separator } from "../elements";
import { Col, Row } from "../layout";
import Icons from "@/assets/icons";
import * as schema from "tttc-common/schema";
import { cn } from "@/lib/utils/shadcn";
import { ReportContext } from "../report/Report";
import {
  getQuoteBridgingScore,
  BRIDGING_THRESHOLDS,
} from "@/lib/bridging/utils";

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
  interview = "Anonymous",
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

export function Quote({
  quote,
  gap = 4,
  withSeperation = false,
}: {
  quote: schema.Quote;
  withSeperation?: boolean;
  gap?: number;
}) {
  const { addOns, sortByBridging } = useContext(ReportContext);
  const bridgingScore = getQuoteBridgingScore(addOns, quote.id);

  return (
    <Col gap={gap}>
      {quote.reference.data[0] === "video" ? (
        <Col gap={gap}>
          <Video
            src={quote.reference.data[1].link}
            startTimestamp={quote.reference.data[1].beginTimestamp}
          />
        </Col>
      ) : null}
      <Row className="items-start gap-2">
        <div className="flex-1">
          <QuoteText text={quote.text} interview={quote.reference.interview} />
        </div>
        {bridgingScore !== null && (
          <QuoteBridgingIndicator
            score={bridgingScore}
            forceShow={sortByBridging}
          />
        )}
      </Row>
      {withSeperation ? <Separator /> : null}
    </Col>
  );
}

/**
 * Compact bridging indicator for quotes.
 * Shows a small colored dot for bridging (green) or divisive (red) quotes.
 * In default mode: hide all labels
 * In sort by bridging mode: show all labels (bridging, divisive, and neutral)
 */
function QuoteBridgingIndicator({
  score,
  forceShow = false,
}: {
  score: number;
  forceShow?: boolean;
}) {
  const isHighBridging = score >= BRIDGING_THRESHOLDS.MIN_DISPLAY;
  const isDivisive = score < BRIDGING_THRESHOLDS.NEUTRAL;

  // Default mode: hide all bridging indicators
  if (!forceShow) {
    return null;
  }

  // Sort by bridging mode: show all labels (bridging, divisive, neutral)

  let colorClass: string;
  let label: string;
  if (isHighBridging) {
    colorClass = "bg-green-500";
    label = "Bridging";
  } else if (isDivisive) {
    colorClass = "bg-red-500";
    label = "Divisive";
  } else {
    colorClass = "bg-gray-400";
    label = "Neutral";
  }

  return (
    <div
      className={`w-2 h-2 rounded-full ${colorClass} flex-shrink-0 mt-2`}
      title={label}
      aria-label={label}
    />
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

const Video = ({
  src,
  startTimestamp,
}: {
  src: string;
  startTimestamp: string;
}) => {
  const link = formatLink(src, startTimestamp);
  console.log(link);
  return (
    <Col>
      <iframe src={link} width={"100%"} className="aspect-video" />
    </Col>
  );
};

const formatLink = (link: string, beginTimestamp: string) => {
  const url = new URL(link);
  if (url.hostname.includes("vimeo"))
    return formatVimeoLink(link, beginTimestamp);
  else if (process.env.NODE_ENV === "development") {
    throw new Error(
      "Video links from sources other than Vimeo are not supported",
    );
  } else {
    return link;
  }
};

const formatVimeoNonEmbeddedLink = (link: string, beginTimestamp: string) => {
  const url = new URL(link);
  const idNum = url.pathname
    .split("/")
    .find((segment) => /^[0-9]+$/.test(segment));
  return `https://player.vimeo.com/video/${idNum || ""}#t=${beginTimestamp}`;
};

const formatVimeoLink = (link: string, beginTimestamp: string) =>
  link.includes("player")
    ? link
    : formatVimeoNonEmbeddedLink(link, beginTimestamp);
