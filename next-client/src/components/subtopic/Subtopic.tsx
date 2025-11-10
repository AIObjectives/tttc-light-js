import React, { forwardRef, useContext, useState } from "react";
import * as schema from "tttc-common/schema";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { ExpandableText, TextIcon } from "../elements";
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
  getControversyColors,
  isSignificantControversy,
  formatControversyScore,
} from "@/lib/crux/utils";

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
  const { addOns, expandedCruxId, setExpandedCruxId } =
    useContext(ReportContext);
  const crux = getSubtopicCrux(addOns, topicTitle, subtopicTitle);

  // Create unique ID for this crux
  const cruxId = `${topicTitle}:${subtopicTitle}`;

  // Auto-expand if this crux was navigated to from the Cruxes tab
  const [isExpanded, setIsExpanded] = useState(false);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (expandedCruxId === cruxId && isMountedRef.current) {
      setIsExpanded(true);
      // Clear the expandedCruxId after expanding
      setExpandedCruxId(null);
    }
  }, [expandedCruxId, cruxId, setExpandedCruxId]);

  // Don't show if no crux data or controversy is too low to be significant
  if (!crux || !isSignificantControversy(crux.controversyScore)) return null;

  const colors = getControversyColors(crux.controversyScore);

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

  const formatSpeakerList = React.useCallback((speakers: string[]) => {
    return speakers.map((s) => {
      const { name, strength } = parseSpeaker(s);
      return (
        <span key={s} className="text-sm">
          {name}
          {strength !== undefined && (
            <span className="text-muted-foreground"> ({strength})</span>
          )}
        </span>
      );
    });
  }, []);

  return (
    <div
      className={`border-l-4 ${colors.border} pl-4 ${colors.bg} rounded p-3`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center cursor-pointer hover:opacity-75"
      >
        <div className="flex gap-2 items-center">
          <span className={`font-medium text-sm ${colors.text}`}>
            Crux (Controversy: {formatControversyScore(crux.controversyScore)})
          </span>
        </div>
        <Icons.ChevronRight16
          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>

      {isExpanded && (
        <Col gap={3} className="mt-3 text-sm">
          <div>
            <p className="font-medium text-gray-900">{crux.cruxClaim}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs mb-1">Explanation:</p>
            <p className="text-gray-700">
              {cleanExplanation(crux.explanation)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-medium text-green-700 mb-1">
                Agree ({crux.agree.length})
              </p>
              <div className="flex flex-col gap-1">
                {formatSpeakerList(crux.agree)}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-red-700 mb-1">
                Disagree ({crux.disagree.length})
              </p>
              <div className="flex flex-col gap-1">
                {formatSpeakerList(crux.disagree)}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">
                No Clear Position ({crux.no_clear_position?.length || 0})
              </p>
              <div className="flex flex-col gap-1">
                {formatSpeakerList(crux.no_clear_position || [])}
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {crux.speakersInvolved} of {crux.totalSpeakersInSubtopic} speakers
            took a position
          </div>
        </Col>
      )}
    </div>
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
