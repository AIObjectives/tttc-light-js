"use client";

import { createContext, type Dispatch, useCallback, useContext } from "react";
import Icons from "@/assets/icons";
import {
  getControversyCategory,
  getControversyColors,
  getSortedCruxes,
} from "@/lib/crux/utils";
import { TextIcon } from "../elements";
import { Col, Row } from "../layout";
import type { ReportStateAction } from "../report/hooks/useReportState";
import { ReportContext } from "../report/Report";
import type {
  OutlineState,
  OutlineStateAction,
  OutlineSubtopicNode,
  OutlineTopicNode,
} from "./hooks/useOutlineState";

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
  onNavigate,
}: {
  outlineState: OutlineState;
  outlineDispatch: Dispatch<OutlineStateAction>;
  reportDispatch: Dispatch<ReportStateAction>;
  /** Called after navigation to allow parent to close mobile sheet */
  onNavigate?: () => void;
}) {
  const {
    setScrollTo,
    dispatch,
    activeContentTab,
    setActiveContentTab,
    addOns,
    focusedCruxId,
    getSubtopicId,
    suppressFocusTracking,
  } = useContext(ReportContext);
  const sortedCruxes = getSortedCruxes(addOns);

  // For mobile outline navigation, we need to scroll AFTER closing the sheet.
  // The useDelayedScroll hook has cleanup that aborts on unmount, which cancels
  // the scroll when the Sheet closes. Instead, we close first then scroll directly.
  const navigateAndScroll = useCallback(
    (targetId: string) => {
      // Close sheet first
      onNavigate?.();
      // Wait for sheet close animation (150ms) to complete before scrolling
      // This prevents visual jank from overlapping animations
      setTimeout(() => {
        setScrollTo([targetId, Date.now()]);
      }, 200);
    },
    [onNavigate, setScrollTo],
  );

  return (
    <OutlineContext.Provider value={{ dispatch: outlineDispatch }}>
      <nav aria-label="Report outline" className="h-full flex flex-col gap-2">
        {/* Top icon */}
        <TextIcon icon={<Icons.Outline size={16} />} className="pl-7">
          Outline
        </TextIcon>
        {/* Scrolly part */}
        <Col gap={outlineSpacing} className="overflow-y-scroll no-scrollbar">
          {activeContentTab === "cruxes"
            ? sortedCruxes.map((crux) => {
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
                      // Close sheet and scroll
                      navigateAndScroll(subtopicId);
                    }}
                  />
                );
              })
            : outlineState.tree.map((node) => (
                <OutlineItem
                  key={node.id}
                  node={node}
                  title={node.title}
                  onBodyClick={() => {
                    // Suppress scroll-based focus tracking during programmatic navigation
                    suppressFocusTracking();
                    // Explicitly set the focus to highlight the clicked item
                    dispatch({
                      type: "focus",
                      payload: { id: node.id },
                    });
                    // Close sheet and scroll (in that order to avoid abort on unmount)
                    navigateAndScroll(node.id);
                  }}
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
                      hierarchyDepth={1}
                      isLeafNode={true}
                      parentId={node.id}
                      onBodyClick={() => {
                        // Suppress scroll-based focus tracking during programmatic navigation
                        suppressFocusTracking();
                        // Open the subtopic to ensure it's visible
                        reportDispatch({
                          type: "open",
                          payload: { id: subnode.id },
                        });
                        // Explicitly set the focus to highlight the clicked item
                        dispatch({
                          type: "focus",
                          payload: { id: subnode.id },
                        });
                        // Close sheet and scroll (in that order to avoid abort on unmount)
                        navigateAndScroll(subnode.id);
                      }}
                    />
                  ))}
                </OutlineItem>
              ))}
        </Col>
      </nav>
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
 * @param hierarchyDepth - Nesting level: 0 for topics, 1 for subtopics (default: 0)
 */
function OutlineItem({
  node,
  title,
  children,
  hierarchyDepth = 0,
  isLeafNode = false,
  onBodyClick,
  onIconClick = () => null,
}: React.PropsWithChildren<{
  node: OutlineTopicNode | OutlineSubtopicNode;
  title: string;
  isLeafNode?: boolean;
  /** Nesting level: 0 for topics, 1 for subtopics */
  hierarchyDepth?: number;
  onBodyClick: () => void;
  onIconClick?: () => void;
  parentId?: string;
}>) {
  // Handle click with touch support for mobile Safari
  // Using onTouchEnd + onClick ensures reliable firing on both mobile and desktop
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onBodyClick();
  };

  // Handle keyboard interaction - Space and Enter activate, Space needs preventDefault to avoid scroll
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); // Prevent Space from scrolling the page
      onBodyClick();
    }
  };

  const isExpanded = node._tag === "OutlineTopicNode" && node.isOpen;
  const hasChildren =
    node._tag === "OutlineTopicNode" && !!node.children?.length && !isLeafNode;

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
          aria-hidden="true"
        >
          <Icons.Minus width={16} />
        </div>
        {/* Nested items should be further to the right */}

        <div
          role="button"
          tabIndex={0}
          aria-expanded={hasChildren ? isExpanded : undefined}
          className={`${hierarchyDepth === 0 ? "" : SUBTOPIC_INDENT} p2 select-none text-ellipsis w-[230px] items-center text-left bg-transparent border-none p-0`}
          onClick={handleInteraction}
          onTouchEnd={handleInteraction}
          onKeyDown={handleKeyDown}
          data-testid={"outline-item-clickable"}
        >
          {title}
        </div>
        {node._tag === "OutlineTopicNode" ? (
          <OutlineCarrot
            onClick={onIconClick}
            isOpen={node.isOpen}
            collapsable={hasChildren}
            title={title}
          />
        ) : null}
      </Row>

      {isExpanded ? children : null}
    </Col>
  );
}

function OutlineCarrot({
  onClick,
  isOpen,
  collapsable,
  title,
}: {
  onClick: () => void;
  isOpen: boolean;
  collapsable: boolean;
  title: string;
}) {
  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  // If not collapsable, add the component but make it permanently invisible to maintain equal spacing.
  if (!collapsable)
    return (
      <div className="invisible" aria-hidden="true">
        <Icons.OutlineCollapsed />
      </div>
    );
  else if (!isOpen) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Expand ${title}`}
        aria-expanded={false}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="invisible group-hover:visible group-hover:text-muted-foreground hover:bg-slate-200 hover:rounded-sm focus:visible"
        data-testid={"outline-expander"}
      >
        <Icons.OutlineCollapsed />
      </div>
    );
  } else {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Collapse ${title}`}
        aria-expanded={true}
        onClick={onClick}
        onKeyDown={handleKeyDown}
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
  // Handle click with touch support for mobile Safari
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  // Handle keyboard interaction - Space and Enter activate, Space needs preventDefault to avoid scroll
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Navigate to crux: ${cruxClaim}`}
      className="flex flex-row gap-2 cursor-pointer hover:bg-accent/50 transition-colors pl-2 max-w-[279px] items-start bg-transparent border-none p-0 text-left w-full"
      onClick={handleInteraction}
      onTouchEnd={handleInteraction}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`w-3 -mt-0.5 ${isHighlighted ? "visible" : "invisible"}`}
        aria-hidden="true"
      >
        <Icons.Minus width={16} />
      </div>
      <span className="p2 select-none w-[230px]">{cruxClaim}</span>
    </div>
  );
}

export default Outline;
