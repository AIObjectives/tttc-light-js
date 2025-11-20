import React, { forwardRef, useContext, useState } from "react";
import * as schema from "tttc-common/schema";
import { CopyLinkButton } from "../copyButton/CopyButton";

// Scroll offset to account for fixed navbar height
const NAVBAR_SCROLL_OFFSET = -80;
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
  getControversyColors,
} from "@/lib/crux/utils";
import {
  ControversyIndicator,
  AgreeDisagreeSpectrum,
} from "@/components/controversy";
import { ControversyIcon } from "@/assets/icons/ControversyIcons";

/**
 * UI for subtopic
 */
export const Subtopic = forwardRef<
  HTMLDivElement,
  {
    subtopicNode: SubtopicNode;
    topicTitle: string;
    onExpandSubtopic: () => void;
  }
>(function TopicComponent({ subtopicNode, topicTitle, onExpandSubtopic }, ref) {
  return (
    <div data-testid={"subtopic-item"}>
      <Col gap={4} className="py-3 sm:py-8 border rounded-[8px]" ref={ref}>
        <SubtopicSummary
          title={subtopicNode.data.title}
          description={subtopicNode.data.description}
          claims={subtopicNode.data.claims}
          topicTitle={topicTitle}
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
      <TextIcon icon={<Icons.Claim />}>
        {numClaims} claims by {numPeople} people
      </TextIcon>
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
}: {
  title: string;
  claims: schema.Claim[];
  description: string;
  topicTitle: string;
}) {
  return (
    <Col gap={4} className="px-4 sm:px-8">
      <SubtopicHeader
        title={title}
        numClaims={claims.length}
        numPeople={getNPeople(claims)}
      />
      <PointGraphic claims={claims} />
      <SubtopicDescription description={description!} />
      <CruxDisplay topicTitle={topicTitle} subtopicTitle={title} />
    </Col>
  );
}

function CruxDisplay({
  topicTitle,
  subtopicTitle,
}: {
  topicTitle: string;
  subtopicTitle: string;
}) {
  const {
    addOns,
    activeContentTab,
    setActiveContentTab,
    setScrollTo,
    getTopicColor,
  } = useContext(ReportContext);
  const crux = getSubtopicCrux(addOns, topicTitle, subtopicTitle);
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false);
  const topicColor = getTopicColor(topicTitle);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Create unique ID for this crux
  const cruxId = `${topicTitle}:${subtopicTitle}`;

  // Cleanup on unmount - abort any pending RAF callbacks
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

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
  const colors = getControversyColors(crux.controversyScore);

  // Handle click: Navigate to Cruxes tab and scroll to this crux
  const handleClick = () => {
    setActiveContentTab("cruxes");

    // Abort any existing pending RAF callbacks
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this click
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    // Use double RAF to ensure tab switch and expansion complete before scrolling
    requestAnimationFrame(() => {
      // Check if aborted between outer and inner RAF
      if (signal.aborted) return;

      requestAnimationFrame(() => {
        // Only update state if not aborted (component still mounted)
        if (!signal.aborted) {
          setScrollTo([cruxId, Date.now()]);
        }
      });
    });
  };

  // Handle subtopic click: Navigate to Report tab and scroll to subtopic
  const handleSubtopicClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const needsTabSwitch = activeContentTab !== "report";

    if (needsTabSwitch) {
      // Abort any existing pending RAF callbacks
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this click
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      // Switch to report tab first, then scroll after render completes
      setActiveContentTab("report");
      // Double requestAnimationFrame ensures React has flushed updates and browser has painted
      requestAnimationFrame(() => {
        if (signal.aborted) return;

        requestAnimationFrame(() => {
          // Only update state if not aborted (component still mounted)
          if (!signal.aborted) {
            setScrollTo([subtopicTitle, Date.now()]);
          }
        });
      });
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
    <HoverCard>
      <HoverCardTrigger asChild>
        <div onClick={handleClick} className="py-3 cursor-pointer">
          <Row gap={2} className="justify-between">
            <div className="flex-1 min-w-0">
              <p className="leading-6 pl-0 text-base font-medium">Crux</p>
              <p className="text-base text-muted-foreground-subtle line-clamp-1">
                {crux.cruxClaim}
              </p>
            </div>
            <div
              className={`flex items-center gap-1 border border-border rounded-md px-2 py-1 self-end ${colors.text}`}
            >
              <ControversyIcon
                level={category.level}
                size={16}
                className={colors.text}
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
          <HoverCardOverlay />
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
                    className={`text-sm text-muted-foreground ${
                      isExplanationExpanded ? "" : "line-clamp-3"
                    }`}
                  >
                    {cleanExplanation(crux.explanation)}
                  </p>
                  {!isExplanationExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExplanationExpanded(true);
                      }}
                      className="text-xs underline mt-1"
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
  return (
    <Col>
      <p className="leading-6 pl-4 md:pl-8 text-base font-medium">Claims</p>
      <Col gap={4}>
        <Col>
          {claimNodes.map((claimNode, i) => {
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
        <ClaimLoader
          remaining={claimNodes.length - pagination - 1}
          onExpandSubtopic={onExpandSubtopic}
        />
      </Col>
    </Col>
  );
}

export default Subtopic;
