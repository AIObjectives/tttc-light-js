import React from "react";
import Icons from "@/assets/icons";
import { Row, Col } from "../layout";
import * as schema from "tttc-common/schema";
import { getQuotes } from "tttc-common/morphisms";
import { InteractiveQuoteCard } from "./HoverQuoteCard";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { getThemeColor } from "@/lib/color";
import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";
import config from "tailwind.config";
import { Quote } from "../quote/Quote";

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
                withSeperation={false}
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
  const { title, number } = claim;
  const quoteNum = getQuotes(claim).length;
  return (
    <Row gap={2} className={`items-center`}>
      <p className="p2">
        #{number}
        &ensp;
        <a id={`${title}`}>{title}</a>
      </p>
      <div className="print:hidden">
        <InteractiveQuoteCard
          claim={claim}
          QuoteIcon={<QuoteIcon num={quoteNum} />}
        />
      </div>
    </Row>
  );
}

export function QuoteIcon({ num }: { num: number }) {
  const hoverBackground = useThemeContextColor("bgAccentHover");
  const fillColor = useThemeContextColor("fill");
  const fontColor = useThemeContextColor("text");
  return (
    <Row
      gap={1}
      className={`px-2 py-[2px] border rounded-sm min-w-fit items-center ${hoverBackground}`}
    >
      <Icons.QuoteBubble className={`${fillColor}`} />
      <p className={`p2 ${fontColor}`}>{num}</p>
    </Row>
  );
}
