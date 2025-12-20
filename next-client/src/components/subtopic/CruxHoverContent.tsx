import type React from "react";
import Icons from "@/assets/icons";
import {
  AgreeDisagreeSpectrum,
  ControversyIndicator,
} from "@/components/controversy";
import {
  HoverCardContent,
  HoverCardOverlay,
  HoverCardPortal,
} from "../elements";
import { Col, Row } from "../layout";
import type { ParsedSpeaker } from "./hooks/useParsedSpeakers";

interface CruxHoverContentProps {
  cruxClaim: string;
  explanation: string;
  controversyScore: number;
  totalPeople: number;
  subtopicTitle: string;
  topicColor?: string;
  parsedAgree: ParsedSpeaker[];
  parsedDisagree: ParsedSpeaker[];
  parsedNoClear: ParsedSpeaker[] | undefined;
  cleanExplanation: (text: string) => string;
  explanationRef: React.Ref<HTMLParagraphElement>;
  isExplanationExpanded: boolean;
  setIsExplanationExpanded: (expanded: boolean) => void;
  showReadMore: boolean;
  handleSubtopicClick: (e: React.MouseEvent) => void;
}

/**
 * Hover card content for crux display.
 * Shows controversy indicator, speaker spectrum, and expandable explanation.
 */
export function CruxHoverContent({
  cruxClaim,
  explanation,
  controversyScore,
  totalPeople,
  subtopicTitle,
  topicColor,
  parsedAgree,
  parsedDisagree,
  parsedNoClear,
  cleanExplanation,
  explanationRef,
  isExplanationExpanded,
  setIsExplanationExpanded,
  showReadMore,
  handleSubtopicClick,
}: CruxHoverContentProps) {
  return (
    <HoverCardPortal>
      {/* biome-ignore lint/complexity/noUselessFragments: Fragment needed for HoverCardPortal to accept multiple children */}
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
                  score={controversyScore}
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
              <p className="font-medium">{cruxClaim}</p>
              <div>
                <p
                  ref={explanationRef}
                  className={`text-sm text-muted-foreground ${
                    isExplanationExpanded ? "" : "line-clamp-3"
                  }`}
                >
                  {cleanExplanation(explanation)}
                </p>
                {showReadMore && !isExplanationExpanded && (
                  <button
                    type="button"
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
  );
}
