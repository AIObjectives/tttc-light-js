import React from "react";
import Icons from "@/assets/icons";
import { Row } from "../layout";
import * as schema from "tttc-common/schema";
import { getQuotes } from "tttc-common/morphisms";
import { InteractiveQuoteCard } from "./HoverQuoteCard";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";

/**
 * Claim component that includes the claim text, quote icon, and link button
 */
export function Claim({ claim }: { claim: schema.Claim }) {
  return (
    <Row
      gap={3}
      className="justify-between px-4 sm:px-8 py-1 items-center"
      data-testid={"claim-item"}
    >
      <ClaimHeader claim={claim} />
      <div>
        <CopyLinkButton anchor={claim.title} />
      </div>
    </Row>
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
      <InteractiveQuoteCard
        claim={claim}
        QuoteIcon={<QuoteIcon num={quoteNum} />}
      />
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
