"use client";

import React, { Ref, createContext, forwardRef, useContext } from "react";
import * as schema from "tttc-common/schema";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../elements";
import { QuoteCard } from "../claim";
import { ReportContext } from "../report/Report";
import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";
import { ThemeClass } from "@/lib/color";

type CellContextType = {
  borderClass: ThemeClass | string;
  backgroundClass: ThemeClass | string;
  hoverClass: ThemeClass | string;
  highlightedClass: ThemeClass | string;
};

const CellContext = createContext<CellContextType>({} as CellContextType);

function PointGraphicWrapper({ children }: React.PropsWithChildren<{}>) {
  const borderClass = useThemeContextColor("border");
  const backgroundClass = useThemeContextColor("bgAccent");
  const hoverClass = useThemeContextColor("bgHover");
  const highlightedClass = useThemeContextColor("bg");

  return (
    <CellContext.Provider
      value={{
        borderClass,
        backgroundClass,
        hoverClass,
        highlightedClass,
      }}
    >
      {children}
    </CellContext.Provider>
  );
}

function PointGraphic({ claims }: { claims: schema.Claim[] }) {
  return (
    <PointGraphicWrapper>
      <div className="flex flex-row w-full flex-wrap gap-[3px]">
        {claims.map((claim) => (
          <Cell key={claim.id} claim={claim} />
        ))}
      </div>
    </PointGraphicWrapper>
  );
}

export const PointGraphicGroup = forwardRef(function PointGraphicGroup(
  { claims, isHighlighted }: { claims: schema.Claim[]; isHighlighted: boolean },
  ref: Ref<HTMLDivElement>,
) {
  return (
    <PointGraphicWrapper>
      {claims.map((claim) => (
        <Cell key={claim.id} claim={claim} isHighlighted={isHighlighted} />
      ))}
    </PointGraphicWrapper>
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
  const { dispatch } = useContext(ReportContext);
  const { borderClass, backgroundClass, hoverClass, highlightedClass } =
    useContext(CellContext);

  const onClick = () => dispatch({ type: "open", payload: { id: claim.id } });
  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger onClick={onClick}>
        <div
          className={`w-3 h-3 ${!isHighlighted ? backgroundClass : highlightedClass} ${borderClass} border rounded-[3px] ${hoverClass}`}
        />
      </HoverCardTrigger>
      <HoverCardContent sideOffset={-1} className="p-4">
        <QuoteCard claim={claim} />
      </HoverCardContent>
    </HoverCard>
  );
}

export default PointGraphic;
