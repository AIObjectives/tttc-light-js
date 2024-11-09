"use client";

import React, { Ref, createContext, forwardRef, useContext } from "react";
import * as schema from "tttc-common/schema";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../elements";
import { ClaimCard } from "../claim/Claim";
import { ReportContext } from "../report/Report";
import { ThemeClass, useThemeColor } from "@src/lib/hooks/useTopicTheme";

type CellContextType = {
  borderClass: ThemeClass | string;
  backgroundClass: ThemeClass | string;
  hoverClass: ThemeClass | string;
  highlightedClass: ThemeClass | string;
};

const CellContext = createContext<CellContextType>({} as CellContextType);

function PointGraphicWrapper({ children }: React.PropsWithChildren<{}>) {
  const borderClass = useThemeColor("border", "");
  const backgroundClass = useThemeColor("bgAccent", "bg-AOI_graph_cell");
  const hoverClass = useThemeColor("bgHover", "hover:bg-slate-700");
  const highlightedClass = useThemeColor("bg", "bg-slate-700");

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
          className={`w-3 h-3 ${!isHighlighted ? backgroundClass : highlightedClass} ${borderClass} border rounded-sm ${hoverClass}`}
        />
      </HoverCardTrigger>
      <HoverCardContent className="p-4">
        <ClaimCard claim={claim} />
      </HoverCardContent>
    </HoverCard>
  );
}

export default PointGraphic;
