import React, {
  forwardRef,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import * as schema from "tttc-common/schema";
import { CopyLinkButton } from "../copyButton/CopyButton";
import {
  ExpandableText,
  TextIcon,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardPortal,
  HoverCardOverlay,
} from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import { Claim } from "../claim";
import { Col, Row } from "../layout";
import Icons from "@/assets/icons";
import ClaimLoader from "./components/ClaimLoader";
import { getNPeople } from "tttc-common/morphisms";
import { ClaimNode, SubtopicNode } from "../report/hooks/useReportState";
import { ClaimItem } from "../claim/ClaimItem";
import { ReportContext } from "../report/Report";
import {
  getSubtopicCrux,
  parseSpeaker,
  getControversyCategory,
} from "@/lib/crux/utils";
import { getThemeColor } from "@/lib/color";
import { useDelayedScroll } from "@/lib/hooks/useDelayedScroll";
import {
  ControversyIndicator,
  AgreeDisagreeSpectrum,
} from "@/components/controversy";
import { ControversyIcon } from "@/assets/icons/ControversyIcons";
import { mergeRefs } from "react-merge-refs";
import { VirtualizedClaimsList } from "./VirtualizedClaimsList";

// Threshold for enabling virtualization. Below this count, the DOM overhead of
// virtualization (absolute positioning, dynamic measurement) isn't worth it.
// At 20+ claims, virtualization significantly reduces DOM nodes and improves
// scroll performance on large reports.
const VIRTUALIZATION_THRESHOLD = 20;

// Suppress useLayoutEffect warning in SSR
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Scroll offset to account for fixed navbar height
const NAVBAR_SCROLL_OFFSET = -80;

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
  const { useScrollTo, useFocusedNode, dispatch } = useContext(ReportContext);

  const scrollRef = useScrollTo(subtopicNode.data.id);
  const focusedRef = useFocusedNode(subtopicNode.data.id, !show);

  // Conditional rendering: don't render hidden subtopics to reduce DOM nodes
  // Users should click "Expand all" before printing to show all content
  if (!show) return null;

  return (
    <SubtopicCard
      subtopicNode={subtopicNode}
      topicTitle={topicTitle}
      topicColor={topicColor}
      ref={mergeRefs([scrollRef, focusedRef])}
      onExpandSubtopic={() =>
        dispatch({ type: "expandSubtopic", payload: { id: subtopicNode.id } })
      }
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
  }
>(function TopicComponent(
  { subtopicNode, topicTitle, topicColor, onExpandSubtopic },
  ref,
) {
  return (
    <div data-testid={"subtopic-item"}>
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
      <div className="flex flex-grow">
        <h5>
          <a id={`${title}`}>{title}</a>
        </h5>
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
        numPeople={getNPeople(claims)}
      />
      <div className="print:hidden">
        <PointGraphic claims={claims} />
      </div>
      <SubtopicDescription description={description!} />
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
  const { addOns, activeContentTab, setActiveContentTab, setScrollTo } =
    useContext(ReportContext);
  const crux = getSubtopicCrux(addOns, topicTitle, subtopicTitle);
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const explanationRef = useRef<HTMLParagraphElement>(null);

  // Use shared hook for delayed scroll with cleanup
  const scrollToAfterRender = useDelayedScroll(setScrollTo);

  // Create unique ID for this crux
  const cruxId = `${topicTitle}:${subtopicTitle}`;

  // Check if explanation text is truncated
  useIsomorphicLayoutEffect(() => {
    if (!explanationRef.current || !crux) return;

    // Temporarily remove line-clamp to measure full height
    const element = explanationRef.current;
    const originalClass = element.className;
    element.className = element.className.replace(/line-clamp-\d+/g, "");

    const fullHeight = element.scrollHeight;

    // Restore line-clamp
    element.className = originalClass;

    const clampedHeight = element.clientHeight;

    // Show button if content would be taller than clamped height
    setShowReadMore(fullHeight > clampedHeight);
  }, [crux?.explanation]);

  // Don't show if no crux data
  if (!crux) return null;

  // Build speaker ID -> name map with useMemo to avoid re-creating on every render
  const speakerIdToName = React.useMemo(() => {
    const map = new Map<string, string>();
    const allSpeakers = [
      ...crux.agree,
      ...crux.disagree,
      ...crux.no_clear_position,
    ];
    allSpeakers.forEach((speakerStr) => {
      const { id, name } = parseSpeaker(speakerStr);
      map.set(id, name);
    });
    return map;
  }, [crux.agree, crux.disagree, crux.no_clear_position]);

  // Clean up the explanation text
  const cleanExplanation = React.useCallback(
    (text: string): string => {
      let cleaned = text;

      // Replace "Participant X" or "Participants X, Y, Z" with actual names
      cleaned = cleaned.replace(
        /Participants?\s+([\d,\s]+)/g,
        (match, idList) => {
          const ids = idList.split(/,\s*/).map((id: string) => id.trim());
          const names = ids
            .map((id: string) => speakerIdToName.get(id) || `Participant ${id}`)
            .join(", ");
          return names;
        },
      );

      // Replace technical terms with natural language
      cleaned = cleaned.replace(/cruxClaim/g, "key point of disagreement");
      cleaned = cleaned.replace(/the cruxClaim/gi, "this claim");
      cleaned = cleaned.replace(
        /'no_clear_position'/g,
        "those without a clear stance",
      );
      cleaned = cleaned.replace(/no_clear_position/g, "unclear position");

      return cleaned;
    },
    [speakerIdToName],
  );

  const category = getControversyCategory(crux.controversyScore);
  const textColorClass = topicColor
    ? getThemeColor(topicColor, "text")
    : "text-muted-foreground";
  const hoverBgClass = topicColor
    ? getThemeColor(topicColor, "bgAccentHover")
    : "hover:bg-accent";

  // Handle click: Navigate to Cruxes tab and scroll to this crux
  const handleClick = () => {
    setActiveContentTab("cruxes");

    // Scroll after state updates complete
    scrollToAfterRender(cruxId);
  };

  // Handle subtopic click: Navigate to Report tab and scroll to subtopic
  const handleSubtopicClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const needsTabSwitch = activeContentTab !== "report";

    if (needsTabSwitch) {
      // Switch to report tab first, then scroll after render completes
      setActiveContentTab("report");
      scrollToAfterRender(subtopicTitle);
    } else {
      // Already on report tab, scroll immediately
      const element = document.getElementById(subtopicTitle);

      // Scroll to the subtopic
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        // Use requestAnimationFrame for scroll offset to ensure smooth scroll completes
        requestAnimationFrame(() => {
          window.scrollBy({ top: NAVBAR_SCROLL_OFFSET, behavior: "auto" });
        });
      }
    }
  };

  // Calculate total people count
  const totalPeople =
    crux.agree.length +
    crux.disagree.length +
    (crux.no_clear_position?.length || 0);

  // Memoize parsed speakers to avoid re-parsing on every render
  const parsedAgree = React.useMemo(
    () =>
      crux.agree.map((s) => {
        const parsed = parseSpeaker(s);
        return { id: parsed.id, name: parsed.name };
      }),
    [crux.agree],
  );

  const parsedDisagree = React.useMemo(
    () =>
      crux.disagree.map((s) => {
        const parsed = parseSpeaker(s);
        return { id: parsed.id, name: parsed.name };
      }),
    [crux.disagree],
  );

  const parsedNoClear = React.useMemo(
    () =>
      crux.no_clear_position?.map((s) => {
        const parsed = parseSpeaker(s);
        return { id: parsed.id, name: parsed.name };
      }),
    [crux.no_clear_position],
  );

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <div onClick={handleClick} className="py-3 cursor-pointer">
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
        </div>
      </HoverCardTrigger>
      <HoverCardPortal>
        <>
          <HoverCardOverlay className="bg-black/[0.03]" />
          <HoverCardContent side="top" className="w-[40rem]">
            <Col gap={3} className="text-sm">
              {/* Header row - matches CruxCard format */}
              <Row
                gap={4}
                className="justify-between items-center flex-wrap pb-2"
              >
                <Row gap={3} className="items-center">
                  <ControversyIndicator
                    score={crux.controversyScore}
                    showLabel={true}
                  />
                  <Row
                    gap={1}
                    className="items-center text-sm text-muted-foreground"
                  >
                    <Icons.People className="w-4 h-4" />
                    <span>{totalPeople} people</span>
                  </Row>
                </Row>
                <button
                  type="button"
                  onClick={handleSubtopicClick}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                >
                  <Icons.Theme className="w-4 h-4" />
                  <span>{subtopicTitle}</span>
                  <Icons.ChevronRight className="w-4 h-4" />
                </button>
              </Row>

              <Col gap={2}>
                <p className="font-medium">{crux.cruxClaim}</p>
                <div>
                  <p
                    ref={explanationRef}
                    className={`text-sm text-muted-foreground ${
                      isExplanationExpanded ? "" : "line-clamp-3"
                    }`}
                  >
                    {cleanExplanation(crux.explanation)}
                  </p>
                  {showReadMore && !isExplanationExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExplanationExpanded(true);
                      }}
                      className="text-xs underline mt-1"
                      aria-expanded={false}
                    >
                      Read more
                    </button>
                  )}
                </div>
              </Col>

              <AgreeDisagreeSpectrum
                agree={parsedAgree}
                disagree={parsedDisagree}
                noClearPosition={parsedNoClear}
                topicColor={topicColor}
              />
            </Col>
          </HoverCardContent>
        </>
      </HoverCardPortal>
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
  const { sortByBridging, addOns } = useContext(ReportContext);

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
