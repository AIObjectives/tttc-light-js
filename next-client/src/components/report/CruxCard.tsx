"use client";

import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { mergeRefs } from "react-merge-refs";
import { logger } from "tttc-common/logger/browser";
import type * as schema from "tttc-common/schema";
import Icons from "@/assets/icons";
import {
  AgreeDisagreeSpectrum,
  ControversyIndicator,
} from "@/components/controversy";
import { getControversyCategory, parseSpeaker } from "@/lib/crux/utils";
import { useDelayedScroll } from "@/lib/hooks/useDelayedScroll";
import { Col, Row } from "../layout";
import { ReportContext } from "./Report";

// Suppress useLayoutEffect warning in SSR
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Create module-specific logger
const cruxLogger = logger.child({ module: "crux-navigation" });

export interface CruxCardProps {
  crux: schema.SubtopicCrux;
  getSubtopicId: (topicTitle: string, subtopicTitle: string) => string | null;
  getTopicColor: (topicTitle: string) => string | undefined;
  onNavigateToSubtopic?: (subtopicId: string) => void;
}

export function CruxCard({
  crux,
  getSubtopicId,
  getTopicColor,
  onNavigateToSubtopic,
}: CruxCardProps) {
  const {
    setScrollTo,
    setExpandedCruxId,
    useScrollTo,
    useFocusedNodeForCruxes,
  } = useContext(ReportContext);
  const subtopicId = getSubtopicId(crux.topic, crux.subtopic);

  // Use shared hook for delayed scroll with cleanup
  const scrollToAfterRender = useDelayedScroll(setScrollTo);

  // Create unique ID for scroll targeting (same as in Subtopic)
  const cruxId = `${crux.topic}:${crux.subtopic}`;
  const scrollRef = useScrollTo(cruxId);
  const focusedRef = useFocusedNodeForCruxes(cruxId);

  const handleClick = () => {
    // Ensure both subtopicId and navigation callback exist
    if (!subtopicId) {
      cruxLogger.warn(
        { topic: crux.topic, subtopic: crux.subtopic },
        "Cannot navigate: subtopic not found",
      );
      return;
    }
    if (!onNavigateToSubtopic) {
      cruxLogger.warn(
        { topic: crux.topic, subtopic: crux.subtopic },
        "Cannot navigate: onNavigateToSubtopic callback not provided",
      );
      return;
    }

    // Set which crux should be auto-expanded (using topic:subtopic as unique ID)
    setExpandedCruxId(`${crux.topic}:${crux.subtopic}`);

    // Switch to overview tab and expand topic/subtopic
    onNavigateToSubtopic(subtopicId);

    // Scroll after state updates complete
    scrollToAfterRender(subtopicId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Handle subtopic click: Navigate to Report tab, expand topic, and scroll to subtopic
  const handleSubtopicClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!subtopicId) {
      cruxLogger.warn(
        { topic: crux.topic, subtopic: crux.subtopic },
        "Cannot navigate: subtopic not found",
      );
      return;
    }

    if (!onNavigateToSubtopic) {
      cruxLogger.warn(
        { topic: crux.topic, subtopic: crux.subtopic },
        "Cannot navigate: onNavigateToSubtopic callback not provided",
      );
      return;
    }

    // Use onNavigateToSubtopic which switches tab AND expands the topic
    onNavigateToSubtopic(subtopicId);

    // Scroll after state updates complete
    scrollToAfterRender(subtopicId);
  };

  const _category = getControversyCategory(crux.controversyScore);

  // Explanation expansion state
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const explanationRef = useRef<HTMLParagraphElement>(null);

  // Check if explanation text is truncated
  useIsomorphicLayoutEffect(() => {
    if (!explanationRef.current) return;

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
  }, [crux.explanation]);

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
    <div
      ref={mergeRefs([scrollRef, focusedRef])}
      className="p-4 rounded-lg border border-border bg-card cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Crux: ${crux.cruxClaim}. Click to view in report.`}
    >
      <Col gap={4}>
        {/* Header row */}
        <Row gap={4} className="justify-between items-center flex-wrap">
          <Row gap={3} className="items-center">
            <ControversyIndicator
              score={crux.controversyScore}
              showLabel={true}
            />
            <Row gap={1} className="items-center text-sm text-muted-foreground">
              <Icons.People className="w-4 h-4" />
              <span>
                {crux.agree.length +
                  crux.disagree.length +
                  (crux.no_clear_position?.length || 0)}{" "}
                people
              </span>
            </Row>
          </Row>
          <button
            type="button"
            onClick={handleSubtopicClick}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
          >
            <Icons.Theme className="w-4 h-4" />
            <span>{crux.subtopic}</span>
            <Icons.ChevronRight className="w-4 h-4" />
          </button>
        </Row>

        {/* Crux claim */}
        <Col gap={2}>
          <p className="text-base font-medium">{crux.cruxClaim}</p>
          <div className="relative">
            <p
              ref={explanationRef}
              className={`text-base text-muted-foreground ${isExplanationExpanded ? "" : "line-clamp-3"}`}
            >
              {crux.explanation}
            </p>
            {showReadMore && !isExplanationExpanded && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExplanationExpanded(true);
                }}
                className="absolute bottom-0 right-0 text-sm underline text-muted-foreground pl-20"
                style={{
                  background:
                    "linear-gradient(to right, transparent 0%, hsl(var(--card)) 40%, hsl(var(--card)) 100%)",
                }}
                aria-expanded={false}
              >
                Read more
              </button>
            )}
          </div>
        </Col>

        {/* Agree/Disagree spectrum */}
        <AgreeDisagreeSpectrum
          agree={parsedAgree}
          disagree={parsedDisagree}
          noClearPosition={parsedNoClear}
          topicColor={getTopicColor(crux.topic)}
        />
      </Col>
    </div>
  );
}
