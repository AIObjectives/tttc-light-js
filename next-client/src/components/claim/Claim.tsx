import React, { useContext } from "react";
import Icons from "@/assets/icons";
import { Row } from "../layout";
import * as schema from "tttc-common/schema";
import { getQuotes } from "tttc-common/morphisms";
import { InteractiveQuoteCard } from "./HoverQuoteCard";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { getThemeColor } from "@/lib/color";
import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";
import config from "tailwind.config";
import { ReportContext } from "../report/Report";
import {
  getBridgingScore,
  formatBridgingScore,
  getBridgingColor,
  getBridgingLabel,
  BRIDGING_THRESHOLDS,
} from "@/lib/bridging/utils";

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
 * Ex: #1 AI design should consider the primary needs of providers. (Quote Icon) (Bridging Badge)
 */
function ClaimHeader({ claim }: { claim: schema.Claim }) {
  const { title, number } = claim;
  const quoteNum = getQuotes(claim).length;
  const { addOns, sortByBridging } = useContext(ReportContext);
  const bridgingScore = getBridgingScore(addOns, claim.id);

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
      {bridgingScore !== null && (
        <BridgingBadge score={bridgingScore} forceShow={sortByBridging} />
      )}
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

/**
 * Bridging score badge showing the claim's bridging potential.
 * Shows for non-neutral scores (score < 0 or score >= 0.3).
 * When sortByBridging is enabled, shows all scores regardless of threshold.
 * Uses simple labels: "Bridging" (green), "Divisive" (red), or "Neutral" (gray).
 */
function BridgingBadge({
  score,
  forceShow = false,
}: {
  score: number;
  forceShow?: boolean;
}) {
  const formattedScore = formatBridgingScore(score);
  const label = getBridgingLabel(score);
  const isHighBridging = score >= BRIDGING_THRESHOLDS.MIN_DISPLAY;
  const isDivisive = score < BRIDGING_THRESHOLDS.NEUTRAL;

  // Don't show badge for neutral scores unless forceShow
  if (!forceShow && !isDivisive && !isHighBridging) {
    return null;
  }

  // Determine color class and label based on score
  let colorClass: string;
  let simpleLabel: string;

  if (isHighBridging) {
    colorClass = "text-green-600";
    simpleLabel = "Bridging";
  } else if (isDivisive) {
    colorClass = "text-red-600";
    simpleLabel = "Divisive";
  } else {
    colorClass = "text-gray-600";
    simpleLabel = "Neutral";
  }

  return (
    <div
      className={`px-2 py-[2px] border rounded-sm text-xs font-medium whitespace-nowrap ${colorClass}`}
      title={`${label} (${formattedScore}%)`}
    >
      {simpleLabel}
    </div>
  );
}
