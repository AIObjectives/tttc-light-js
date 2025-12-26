import { HeartHandshake } from "lucide-react";
import { useContext } from "react";
import type * as schema from "tttc-common/schema";
import { getQuotes } from "tttc-common/transforms";
import Icons from "@/assets/icons";
import {
  BRIDGING_THRESHOLDS,
  getClaimBridgingScore,
} from "@/lib/bridging/utils";
import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";
import { CopyLinkButton } from "../copyButton/CopyButton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
} from "../elements";
import { Col, Row } from "../layout";
import { Quote } from "../quote/Quote";
import { ReportContext } from "../report/Report";
import { InteractiveQuoteCard } from "./HoverQuoteCard";

/**
 * Claim component that includes the claim text, quote icon, and link button
 */
export function Claim({ claim }: { claim: schema.Claim }) {
  const quotes = getQuotes(claim);

  return (
    <>
      <Row
        gap={3}
        className="justify-between px-4 sm:px-8 py-1 print:py-0 items-center"
        data-testid={"claim-item"}
      >
        <ClaimHeader claim={claim} />
        <div>
          <CopyLinkButton anchor={claim.title} />
        </div>
      </Row>
      {/* Print-only quotes section */}
      {quotes.length > 0 && (
        <div className="hidden print:block px-4 sm:px-8" data-print-quotes>
          <Col gap={0}>
            {quotes.map((quote) => (
              <Quote
                key={quote.id}
                quote={quote}
                gap={1}
                withSeparation={false}
              />
            ))}
          </Col>
        </div>
      )}
    </>
  );
}

/**
 * Main body of the claim.
 *
 * Ex: #1 AI design should consider the primary needs of providers. (Quote Icon)
 */
function ClaimHeader({ claim }: { claim: schema.Claim }) {
  const { title, number, id } = claim;
  const quoteNum = getQuotes(claim).length;
  const { addOns } = useContext(ReportContext);

  // Get bridging score for this claim
  const bridgingScore = getClaimBridgingScore(id, addOns);
  const showBridgingBadge =
    bridgingScore !== undefined &&
    bridgingScore >= BRIDGING_THRESHOLDS.MIN_DISPLAY;

  return (
    <Row gap={1} className="items-center">
      <p className="p2">
        #{number}
        &ensp;
        <span id={`${title}`}>{title}</span>
      </p>
      <div className="print:hidden">
        <InteractiveQuoteCard
          claim={claim}
          QuoteIcon={<QuoteIcon num={quoteNum} />}
        />
      </div>
      {showBridgingBadge && <BridgingBadge />}
    </Row>
  );
}

/**
 * Bridging indicator badge with tooltip.
 * Shows for claims with high bridging scores to indicate bridge-building content.
 */
function BridgingBadge() {
  const strokeColor = useThemeContextColor("text");
  const hoverBackground = useThemeContextColor("bgAccentHover");

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <div
          className={`flex w-7 h-7 shrink-0 border rounded-sm items-center justify-center cursor-default ${hoverBackground}`}
        >
          <HeartHandshake
            className={`w-4 h-4 shrink-0 ${strokeColor} fill-none`}
          />
        </div>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent side="top" className="w-auto px-3 py-1.5">
          <p className="text-sm">Bridging statement</p>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}

export function QuoteIcon({ num }: { num: number }) {
  const hoverBackground = useThemeContextColor("bgAccentHover");
  const fillColor = useThemeContextColor("fill");
  const fontColor = useThemeContextColor("text");
  return (
    <Row
      gap={1}
      className={`h-7 px-2 border rounded-sm min-w-fit items-center ${hoverBackground}`}
    >
      <Icons.QuoteBubble className={`${fillColor}`} />
      <p className={`p2 ${fontColor}`}>{num}</p>
    </Row>
  );
}
