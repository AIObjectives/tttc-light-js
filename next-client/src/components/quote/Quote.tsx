import type * as schema from "tttc-common/schema";
import Icons from "@/assets/icons";
import { cn } from "@/lib/utils/shadcn";
import { Card, CardContent, Separator } from "../elements";
import { Col, Row } from "../layout";

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
    <Row gap={3} className="w-full quote-row">
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
      <QuoteText text={quote.text} interview={quote.reference.interview} />
      {withSeperation ? <Separator /> : null}
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
      <iframe
        title="Video player"
        src={link}
        width={"100%"}
        className="aspect-video"
      />
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
