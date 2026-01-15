import React, { forwardRef, useContext, useMemo } from "react";
import type * as schema from "tttc-common/schema";
import { getNPeopleFromClaims } from "tttc-common/transforms";
import Icons from "@/assets/icons";
import { ControversyIcon } from "@/assets/icons/ControversyIcons";
import { getThemeColor } from "@/lib/color";
import {
  createExplanationCleaner,
  getControversyCategory,
  getSubtopicCrux,
} from "@/lib/crux/utils";
import { useDelayedScroll } from "@/lib/hooks/useDelayedScroll";
import { useFocusTracking } from "@/stores/hooks";
import { useReportStore } from "@/stores/reportStore";
import {
  useActiveContentTab,
  useReportUIStore,
  useSortByBridging,
} from "@/stores/reportUIStore";
import type { ClaimNode, SubtopicNode } from "@/stores/types";
import { Claim } from "../claim";
import { ClaimItem } from "../claim/ClaimItem";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { ExpandableText, HoverCard, HoverCardTrigger } from "../elements";
import { Col, Row } from "../layout";
import PointGraphic from "../pointGraphic/PointGraphic";
import { ReportDataContext } from "../report/Report";
import { CruxHoverContent } from "./CruxHoverContent";
import ClaimLoader from "./components/ClaimLoader";
import { useCruxNavigation } from "./hooks/useCruxNavigation";
import { useParsedSpeakers } from "./hooks/useParsedSpeakers";
import { useTextTruncation } from "./hooks/useTextTruncation";
import { VirtualizedClaimsList } from "./VirtualizedClaimsList";

// Threshold for enabling virtualization. Below this count, the DOM overhead of
// virtualization (absolute positioning, dynamic measurement) isn't worth it.
// At 20+ claims, virtualization significantly reduces DOM nodes and improves
// scroll performance on large reports.
const VIRTUALIZATION_THRESHOLD = 20;

/**
 * Second highest level node in a Report. Expands to show claims.
 * This wrapper handles scroll/focus refs and visibility.
 */
export function Subtopic({
  subtopicNode,
  topicTitle,
  topicColor,
  show,
}: {
  subtopicNode: SubtopicNode;
  topicTitle: string;
  topicColor?: string;
  show: boolean;
}) {
  // Use Zustand hook for focus tracking
  const focusedRef = useFocusTracking(subtopicNode.data.id);
  const expandPagination = useReportStore((s) => s.expandPagination);

  // Conditional rendering: don't render hidden subtopics to reduce DOM nodes
  // Users should click "Expand all" before printing to show all content
  if (!show) return null;

  return (
    <SubtopicCard
      subtopicNode={subtopicNode}
      topicTitle={topicTitle}
      topicColor={topicColor}
      ref={focusedRef}
      id={subtopicNode.data.id}
      onExpandSubtopic={() => expandPagination(subtopicNode.id)}
    />
  );
}

/**
 * UI for subtopic card
 */
export const SubtopicCard = forwardRef<
  HTMLDivElement,
  {
    subtopicNode: SubtopicNode;
    topicTitle: string;
    topicColor?: string;
    onExpandSubtopic: () => void;
    /** ID for scroll targeting via useScrollEffect */
    id: string;
  }
>(function TopicComponent(
  { subtopicNode, topicTitle, topicColor, onExpandSubtopic, id },
  ref,
) {
  return (
    <div data-testid={"subtopic-item"} id={id}>
      <Col gap={4} className="py-3 sm:py-8 border rounded-[8px]" ref={ref}>
        <SubtopicSummary
          title={subtopicNode.data.title}
          description={subtopicNode.data.description}
          claims={subtopicNode.data.claims}
          topicTitle={topicTitle}
          topicColor={topicColor}
        />
        <SubtopicClaims
          claimNodes={subtopicNode.children}
          pagination={subtopicNode.pagination}
          onExpandSubtopic={onExpandSubtopic}
        />
      </Col>
    </div>
  );
});

export function SubtopicHeader({
  title,
  numClaims,
  numPeople,
}: {
  title: string;
  numClaims: number;
  numPeople: number;
}) {
  return (
    <Row gap={4} className="justify-between items-center">
      <div className="flex grow">
        <h5 id={`${title}`}>{title}</h5>
      </div>
      <div className="flex items-center gap-2">
        <div className="print:hidden">
          <Icons.Claim className="h-4 w-4" />
        </div>
        <p className="p2 text-muted-foreground">
          {numClaims} claims by {numPeople} people
        </p>
      </div>
      <CopyLinkButton anchor={title} />
    </Row>
  );
}

export function SubtopicDescription({ description }: { description: string }) {
  return <ExpandableText>{description}</ExpandableText>;
}

export function SubtopicSummary({
  title,
  claims,
  description,
  topicTitle,
  topicColor,
}: {
  title: string;
  claims: schema.Claim[];
  description: string;
  topicTitle: string;
  topicColor?: string;
}) {
  return (
    <Col gap={4} className="px-4 sm:px-8">
      <SubtopicHeader
        title={title}
        numClaims={claims.length}
        numPeople={getNPeopleFromClaims(claims)}
      />
      <div className="print:hidden">
        <PointGraphic claims={claims} />
      </div>
      <SubtopicDescription description={description} />
      <CruxDisplay
        topicTitle={topicTitle}
        subtopicTitle={title}
        topicColor={topicColor}
      />
    </Col>
  );
}

function CruxDisplay({
  topicTitle,
  subtopicTitle,
  topicColor,
}: {
  topicTitle: string;
  subtopicTitle: string;
  topicColor?: string;
}) {
  const { addOns } = useContext(ReportDataContext);
  const activeContentTab = useActiveContentTab();
  const setActiveContentTab = useReportUIStore((s) => s.setActiveContentTab);
  const scrollTo = useReportUIStore((s) => s.scrollTo);
  const crux = getSubtopicCrux(addOns, topicTitle, subtopicTitle);
  const scrollToAfterRender = useDelayedScroll(scrollTo);
  const cruxId = `${topicTitle}:${subtopicTitle}`;

  // Extract text truncation logic to hook
  const {
    ref: explanationRef,
    isExpanded,
    setIsExpanded,
    showReadMore,
  } = useTextTruncation(crux?.explanation);

  // Extract speaker parsing to hook
  const {
    speakerIdToName,
    parsedAgree,
    parsedDisagree,
    parsedNoClear,
    totalPeople,
  } = useParsedSpeakers(crux);

  // Extract navigation handlers to hook
  const { handleCruxClick, handleSubtopicClick } = useCruxNavigation({
    cruxId,
    subtopicTitle,
    activeContentTab,
    setActiveContentTab,
    scrollToAfterRender,
  });

  // Memoize explanation cleaner
  const cleanExplanation = useMemo(
    () => createExplanationCleaner(speakerIdToName),
    [speakerIdToName],
  );

  // Early return after all hooks
  if (!crux) return null;

  // Compute theme colors
  const category = getControversyCategory(crux.controversyScore);
  const textColorClass = topicColor
    ? getThemeColor(topicColor, "text")
    : "text-muted-foreground";
  const hoverBgClass = topicColor
    ? getThemeColor(topicColor, "bgAccentHover")
    : "hover:bg-accent";

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={handleCruxClick}
          className="py-3 cursor-pointer bg-transparent border-none p-0 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <p className="leading-6 pl-0 text-base font-medium">Crux</p>
          <Row gap={2} className="justify-between items-start">
            <p className="leading-6 text-foreground flex-1 min-w-0">
              {crux.cruxClaim}
            </p>
            <div
              className={`flex items-center gap-1 border border-border rounded-md px-2 py-1 shrink-0 ${hoverBgClass} transition-colors ${textColorClass}`}
            >
              <ControversyIcon
                level={category.level}
                size={16}
                className={textColorClass}
              />
              <span className="text-xs font-medium">
                {category.label} controversy
              </span>
            </div>
          </Row>
        </button>
      </HoverCardTrigger>
      <CruxHoverContent
        cruxClaim={crux.cruxClaim}
        explanation={crux.explanation}
        controversyScore={crux.controversyScore}
        totalPeople={totalPeople}
        subtopicTitle={subtopicTitle}
        topicColor={topicColor}
        parsedAgree={parsedAgree}
        parsedDisagree={parsedDisagree}
        parsedNoClear={parsedNoClear}
        cleanExplanation={cleanExplanation}
        explanationRef={explanationRef}
        isExplanationExpanded={isExpanded}
        setIsExplanationExpanded={setIsExpanded}
        showReadMore={showReadMore}
        handleSubtopicClick={handleSubtopicClick}
      />
    </HoverCard>
  );
}

export function SubtopicClaims({
  claimNodes,
  onExpandSubtopic,
  pagination,
}: {
  claimNodes: ClaimNode[];
  pagination: number;
  onExpandSubtopic: () => void;
}) {
  const sortByBridging = useSortByBridging();
  const { addOns } = useContext(ReportDataContext);

  // Sort claims by bridging score if enabled
  // Claims without bridging scores default to -1, placing them at the bottom
  // when sorted. This treats unscored content as "less bridging" than scored content.
  const sortedClaims = React.useMemo(() => {
    if (!sortByBridging || !addOns?.claimBridgingScores) {
      return claimNodes;
    }

    // Build lookup map once: O(n) instead of O(n²) with repeated find() calls
    const scoreMap = new Map(
      addOns.claimBridgingScores.map((s) => [s.claimId, s.bridgingScore]),
    );

    return [...claimNodes].sort((a, b) => {
      const scoreA = scoreMap.get(a.id) ?? -1;
      const scoreB = scoreMap.get(b.id) ?? -1;
      // Sort descending (highest bridging score first)
      return scoreB - scoreA;
    });
  }, [sortByBridging, claimNodes, addOns]);

  // Determine if we should use virtualization based on visible claim count
  const visibleCount = Math.min(sortedClaims.length, pagination + 1);
  const shouldVirtualize = visibleCount > VIRTUALIZATION_THRESHOLD;

  return (
    <Col>
      <p className="leading-6 pl-4 md:pl-8 print:pl-0 text-base font-medium">
        Claims
      </p>
      <Col gap={4}>
        {shouldVirtualize ? (
          <VirtualizedClaimsList
            claims={sortedClaims}
            pagination={pagination}
          />
        ) : (
          <Col>
            {sortedClaims.map((claimNode, i) => {
              return (
                <ClaimItem
                  key={claimNode.id}
                  show={i <= pagination}
                  id={claimNode.id}
                >
                  <Claim claim={claimNode.data} />
                </ClaimItem>
              );
            })}
          </Col>
        )}
        <ClaimLoader
          remaining={sortedClaims.length - pagination - 1}
          onExpandSubtopic={onExpandSubtopic}
        />
      </Col>
    </Col>
  );
}

export default Subtopic;
