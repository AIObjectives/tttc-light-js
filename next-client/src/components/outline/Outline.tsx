"use client";

import { TextIcon } from "../elements";
import Icons from "@/assets/icons";
import { Col, Row } from "../layout";
import { Dispatch, createContext, useContext } from "react";
import { ReportContext } from "../report/Report";
import {
  useOutlineState,
  OutlineTopicNode,
  OutlineSubtopicNode,
  OutlineStateAction,
  OutlineState,
} from "./hooks/useOutlineState";
import { ReportStateAction } from "../report/hooks/useReportState";
import {
  getSortedCruxes,
  getControversyCategory,
  getControversyColors,
} from "@/lib/crux/utils";
import { useDelayedScroll } from "@/lib/hooks/useDelayedScroll";

type OutlineContextType = {
  dispatch: Dispatch<OutlineStateAction>;
};

const OutlineContext = createContext<OutlineContextType>({
  dispatch: () => {},
});

const outlineSpacing = 2;

/**
 * Tailwind padding class for subtopic indentation.
 * Currently supports 2-level hierarchy only (Topic → Subtopic).
 */
const SUBTOPIC_INDENT = "pl-4";

function Outline({
  outlineState,
  outlineDispatch,
  reportDispatch,
}: {
  outlineState: OutlineState;
  outlineDispatch: Dispatch<OutlineStateAction>;
  reportDispatch: Dispatch<ReportStateAction>;
}) {
  const {
    setScrollTo,
    activeContentTab,
    setActiveContentTab,
    addOns,
    focusedCruxId,
    getSubtopicId,
  } = useContext(ReportContext);
  const sortedCruxes = getSortedCruxes(addOns);
  const scrollToAfterRender = useDelayedScroll(setScrollTo);

  return (
    <OutlineContext.Provider value={{ dispatch: outlineDispatch }}>
      <Col gap={2} className="h-full">
        {/* Top icon */}
        <TextIcon icon={<Icons.Outline size={16} />} className="pl-7">
          Outline
        </TextIcon>
        {/* Scrolly part */}
        <Col gap={outlineSpacing} className="overflow-y-scroll no-scrollbar">
          {activeContentTab === "cruxes" ? (
            <>
              {sortedCruxes.map((crux) => {
                const cruxId = `${crux.topic}:${crux.subtopic}`;
                const category = getControversyCategory(crux.controversyScore);
                const colors = getControversyColors(crux.controversyScore);
                const isHighlighted = focusedCruxId === cruxId;
                const subtopicId = getSubtopicId(crux.topic, crux.subtopic);
                return (
                  <CruxOutlineItem
                    key={cruxId}
                    cruxClaim={crux.cruxClaim}
                    subtopic={crux.subtopic}
                    category={category}
                    colors={colors}
                    isHighlighted={isHighlighted}
                    onClick={() => {
                      if (!subtopicId) {
                        console.warn(
                          `[Outline] Cannot navigate: subtopic "${crux.subtopic}" not found in topic "${crux.topic}"`,
                        );
                        return;
                      }
                      // Switch to report tab and expand the subtopic
                      setActiveContentTab("report");
                      reportDispatch({
                        type: "open",
                        payload: { id: subtopicId },
                      });
                      // Scroll after state updates (with cleanup on unmount)
                      scrollToAfterRender(subtopicId);
                    }}
                  />
                );
              })}
            </>
          ) : (
            <>
              {outlineState.tree.map((node) => (
                <OutlineItem
                  key={node.id}
                  node={node}
                  title={node.title}
                  onBodyClick={() => setScrollTo([node.id, Date.now()])}
                  onIconClick={() =>
                    reportDispatch({
                      type: "toggleTopic",
                      payload: { id: node.id },
                    })
                  }
                >
                  {/* Since we're only going two levels deep, directly call the render for the subnodes here. */}
                  {node?.children?.map((subnode) => (
                    <OutlineItem
                      key={subnode.id}
                      node={subnode}
                      title={subnode.title}
                      heirarchyDepth={1}
                      isLeafNode={true}
                      parentId={node.id}
                      onBodyClick={() =>
                        reportDispatch({
                          type: "open",
                          payload: { id: subnode.id },
                        })
                      }
                    />
                  ))}
                </OutlineItem>
              ))}
            </>
          )}
        </Col>
      </Col>
    </OutlineContext.Provider>
  );
}

/**
 * Renders an outline item with indentation based on hierarchy depth.
 *
 * **Depth Levels:**
 * - `0`: Topic level (no indent)
 * - `1`: Subtopic level (pl-4 indent via SUBTOPIC_INDENT constant)
 *
 * **Note:** Hierarchy is currently limited to 2 levels (Topic → Subtopic)
 * because the report structure only has claims under subtopics, and claims
 * are not shown in the outline. If claim-level outline items are added in
 * the future, this would need to support depth=2 with additional padding.
 *
 * @param heirarchyDepth - Nesting level: 0 for topics, 1 for subtopics (default: 0)
 */
function OutlineItem({
  node,
  title,
  children,
  heirarchyDepth = 0,
  isLeafNode = false,
  onBodyClick,
  onIconClick = () => null,
}: React.PropsWithChildren<{
  node: OutlineTopicNode | OutlineSubtopicNode;
  title: string;
  isLeafNode?: boolean;
  /** Nesting level: 0 for topics, 1 for subtopics */
  heirarchyDepth?: number;
  onBodyClick: () => void;
  onIconClick?: () => void;
  parentId?: string;
}>) {
  return (
    // column here because opened nodes should continue the spacing.
    <Col
      gap={outlineSpacing}
      className="pl-2 max-w-[279px]"
      data-testid={"outline-item"}
    >
      <Row
        gap={2}
        className={`group items-center ${node.isHighlighted ? node.color : ""} ${node.hoverColor} cursor-pointer`}
      >
        {/* The Minus icon should appear on hover, but shouldn't shift the spacing */}
        <div
          className={`${node.isHighlighted ? `visible ${node.color}` : "invisible"} content-center w-3`}
          onClick={onBodyClick}
        >
          <Icons.Minus width={16} />
        </div>
        {/* Nested items should be further to the right */}

        <p
          className={`${heirarchyDepth === 0 ? "" : SUBTOPIC_INDENT} p2 select-none text-ellipsis w-[230px] items-center`}
          onClick={onBodyClick}
          data-testid={"outline-item-clickable"}
        >
          {title}
        </p>
        {node._tag === "OutlineTopicNode" ? (
          <OutlineCarrot
            onClick={onIconClick}
            isOpen={node.isOpen}
            collapsable={!!node.children?.length && !isLeafNode}
          />
        ) : null}
      </Row>

      {node._tag === "OutlineTopicNode" && node.isOpen ? children : null}
    </Col>
  );
}

function OutlineCarrot({
  onClick,
  isOpen,
  collapsable,
}: {
  onClick: () => void;
  isOpen: boolean;
  collapsable: boolean;
}) {
  // If not collapsable, add the component but make it permanently invisible to maintain equal spacing.
  if (!collapsable)
    return (
      <div className="invisible">
        <Icons.OutlineCollapsed />
      </div>
    );
  else if (!isOpen) {
    return (
      <div
        onClick={onClick}
        className="invisible group-hover:visible group-hover:text-muted-foreground hover:bg-slate-200 hover:rounded-sm"
        data-testid={"outline-expander"}
      >
        <Icons.OutlineCollapsed />
      </div>
    );
  } else {
    return (
      <div
        onClick={onClick}
        className="hover:bg-slate-200 hover:rounded-sm"
        data-testid={"outline-expander"}
      >
        <Icons.OutlineExpanded />
      </div>
    );
  }
}

function CruxOutlineItem({
  cruxClaim,
  subtopic,
  category,
  colors,
  isHighlighted,
  onClick,
}: {
  cruxClaim: string;
  subtopic: string;
  category: ReturnType<typeof getControversyCategory>;
  colors: ReturnType<typeof getControversyColors>;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  return (
    <Row
      gap={2}
      className="cursor-pointer hover:bg-accent/50 transition-colors pl-2 max-w-[279px] items-start"
      onClick={onClick}
    >
      <div className={`w-3 -mt-0.5 ${isHighlighted ? "visible" : "invisible"}`}>
        <Icons.Minus width={16} />
      </div>
      <p className="p2 select-none w-[230px]">{cruxClaim}</p>
    </Row>
  );
}

export default Outline;
