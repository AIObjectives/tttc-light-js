import type { ReactNode } from "react";
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
  text: string | ReactNode;
  interview: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <Row gap={3} className="w-full quote-row">
      {/* Quote Icon */}
      <div className="self-start shrink-0 py-[5px]">
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
  withSeparation = false,
}: {
  quote: schema.Quote;
  withSeparation?: boolean;
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
      {withSeparation ? <Separator /> : null}
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
  if (!link) return null;
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

export const parseTimestampToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  return parts[0] ?? 0;
};

const YOUTUBE_HOSTNAMES = new Set([
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
]);

const VIMEO_HOSTNAMES = new Set([
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
]);

export const extractYouTubeVideoId = (link: string): string | null => {
  const url = new URL(link);
  if (url.pathname.startsWith("/embed/")) {
    return url.pathname.split("/embed/")[1]?.split("/")[0] || null;
  }
  if (YOUTUBE_HOSTNAMES.has(url.hostname) && url.hostname !== "youtu.be") {
    return url.searchParams.get("v");
  }
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  return null;
};

export const formatYouTubeLink = (
  link: string,
  beginTimestamp: string,
): string => {
  const url = new URL(link);
  const startSeconds = parseTimestampToSeconds(beginTimestamp);
  if (url.pathname.startsWith("/embed/")) {
    if (startSeconds > 0) url.searchParams.set("start", String(startSeconds));
    return url.toString();
  }
  const videoId = extractYouTubeVideoId(link);
  if (!videoId) return "";
  const startParam = startSeconds > 0 ? `?start=${startSeconds}` : "";
  return `https://www.youtube.com/embed/${videoId}${startParam}`;
};

const formatLink = (link: string, beginTimestamp: string): string => {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (VIMEO_HOSTNAMES.has(url.hostname))
    return formatVimeoLink(link, beginTimestamp);
  if (YOUTUBE_HOSTNAMES.has(url.hostname))
    return formatYouTubeLink(link, beginTimestamp);
  return "";
};

const formatVimeoNonEmbeddedLink = (link: string, beginTimestamp: string) => {
  const url = new URL(link);
  const [id, hash] = url.pathname.split("/").filter(Boolean);
  const hashParam = hash ? `?h=${hash}` : "";
  return `https://player.vimeo.com/video/${id || ""}${hashParam}#t=${beginTimestamp}`;
};

const formatVimeoLink = (link: string, beginTimestamp: string) =>
  link.includes("player")
    ? link
    : formatVimeoNonEmbeddedLink(link, beginTimestamp);
