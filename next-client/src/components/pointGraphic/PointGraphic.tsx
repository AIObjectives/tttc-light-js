"use client";

import type React from "react";
import { createContext, useContext } from "react";
import type * as schema from "tttc-common/schema";
import type { ThemeClass } from "@/lib/color";
import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";
import { useReportStore } from "@/stores/reportStore";
import { QuoteCard } from "../claim";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../elements";

type CellContextType = {
  borderClass: ThemeClass | string;
  backgroundClass: ThemeClass | string;
  hoverClass: ThemeClass | string;
  highlightedClass: ThemeClass | string;
};

const CellContext = createContext<CellContextType>({} as CellContextType);

function PointGraphicWrapper({ children }: React.PropsWithChildren) {
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

export function PointGraphicGroup({
  claims,
  isHighlighted,
}: {
  claims: schema.Claim[];
  isHighlighted: boolean;
}) {
  return (
    <PointGraphicWrapper>
      {claims.map((claim) => (
        <Cell key={claim.id} claim={claim} isHighlighted={isHighlighted} />
      ))}
    </PointGraphicWrapper>
  );
}

interface ICell
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > {
  claim: schema.Claim;
  isHighlighted?: boolean;
}

export function Cell({ claim, isHighlighted }: ICell) {
  const openNode = useReportStore((s) => s.openNode);
  const { borderClass, backgroundClass, hoverClass, highlightedClass } =
    useContext(CellContext);

  const onClick = () => openNode(claim.id);
  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger onClick={onClick}>
        <div
          className={`w-3 h-3 ${!isHighlighted ? backgroundClass : highlightedClass} ${borderClass} border rounded-[3px] ${hoverClass}`}
          data-testid={"point-graphic-cell"}
        />
      </HoverCardTrigger>
      <HoverCardContent sideOffset={-1} collisionPadding={16} className="p-4">
        <QuoteCard claim={claim} />
      </HoverCardContent>
    </HoverCard>
  );
}

export default PointGraphic;
