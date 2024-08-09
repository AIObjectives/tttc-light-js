"use client";

import React, { Ref, forwardRef } from "react";
import * as schema from "tttc-common/schema";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../elements";
import { ClaimHeader, QuoteText } from "../claim/Claim";
import { Col } from "../layout";

function PointGraphic({ claims }: { claims: schema.Claim[] }) {
  return (
    <div className="flex flex-row w-full flex-wrap gap-[3px]">
      {claims.map((claim, i) => (
        <Cell claim={claim} />
      ))}
    </div>
  );
}

export const PointGraphicGroup = forwardRef(function PointGraphicGroup(
  { claims, isHighlighted }: { claims: schema.Claim[]; isHighlighted: boolean },
  ref: Ref<HTMLDivElement>,
) {
  return (
    <div className="flex flex-row gap-[3px]" ref={ref}>
      {claims.map((claim, i) => (
        <Cell claim={claim} isHighlighted={isHighlighted} />
      ))}
    </div>
  );
});

interface ICell
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > {
  claim: schema.Claim;
  isHighlighted?: boolean;
}

export function Cell(
  { claim, isHighlighted }: ICell,
  ref: Ref<HTMLDivElement>,
) {
  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger>
        <div
          className={`w-3 h-3 bg-AOI_graph_cell rounded-sm hover:bg-slate-700 ${isHighlighted ? "bg-slate-700" : ""}`}
        />
      </HoverCardTrigger>
      <HoverCardContent className="p-4 w-full">
        <ClaimCard claim={claim} />
      </HoverCardContent>
    </HoverCard>
  );
}

function ClaimCard({ claim }: { claim: schema.Claim }) {
  return (
    // <CardContent className="p-4">
    <Col gap={4}>
      <ClaimHeader title={claim.title} claimNum={claim.number} />
      <Col gap={2}>
        {claim.quotes.map((quote) => (
          <QuoteText text={quote.text} />
        ))}
      </Col>
    </Col>
    // </CardContent>
  );
}

export default PointGraphic;
