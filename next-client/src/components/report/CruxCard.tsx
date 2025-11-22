"use client";

import React, { useContext } from "react";
import { mergeRefs } from "react-merge-refs";
import * as schema from "tttc-common/schema";
import Icons from "@/assets/icons";
import { Col, Row } from "../layout";
import {
  ControversyIndicator,
  AgreeDisagreeSpectrum,
} from "@/components/controversy";
import { getControversyCategory, parseSpeaker } from "@/lib/crux/utils";
import { ReportContext } from "./Report";
import { logger } from "tttc-common/logger/browser";

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
    activeContentTab,
    setActiveContentTab,
  } = useContext(ReportContext);
  const subtopicId = getSubtopicId(crux.topic, crux.subtopic);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Create unique ID for scroll targeting (same as in Subtopic)
  const cruxId = `${crux.topic}:${crux.subtopic}`;
  const scrollRef = useScrollTo(cruxId);
  const focusedRef = useFocusedNodeForCruxes(cruxId);

  // Cleanup on unmount - abort any pending RAF callbacks
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

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
          setScrollTo([subtopicId, Date.now()]);
        }
      });
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Handle subtopic click: Navigate to Report tab and scroll to subtopic
  const handleSubtopicClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!subtopicId) {
      cruxLogger.warn(
        { topic: crux.topic, subtopic: crux.subtopic },
        "Cannot navigate: subtopic not found",
      );
      return;
    }

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
      // Double RAF ensures React has flushed updates and browser has painted
      requestAnimationFrame(() => {
        if (signal.aborted) return;

        requestAnimationFrame(() => {
          if (!signal.aborted) {
            const element = document.getElementById(subtopicId);
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
        });
      });
    } else {
      // Already on report tab, scroll immediately
      const element = document.getElementById(subtopicId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const category = getControversyCategory(crux.controversyScore);

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
      className="p-4 rounded-lg border border-border bg-card"
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
          <p className="font-medium">{crux.cruxClaim}</p>
          <p className="text-sm text-muted-foreground">{crux.explanation}</p>
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
