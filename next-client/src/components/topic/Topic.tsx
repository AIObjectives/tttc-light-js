"use client";

import type React from "react";
import { createContext, forwardRef, useContext } from "react";
import { mergeRefs } from "react-merge-refs";
import {
  getNClaims,
  getNPeopleFromClaims,
  getNPeopleFromSubtopics,
} from "tttc-common/morphisms";
import type * as schema from "tttc-common/schema";
import Icons from "@/assets/icons";
import { ControversyIndicator } from "@/components/controversy";
import { getThemeColor } from "@/lib/color";
import { getTopicControversy } from "@/lib/crux/utils";
import { CopyLinkButton } from "../copyButton/CopyButton";
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  ExpandableText,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Separator,
  WordLimitExpandableText,
} from "../elements";
import { Col, Row } from "../layout";
import useGroupHover from "../pointGraphic/hooks/useGroupHover";
import { PointGraphicGroup } from "../pointGraphic/PointGraphic";
import type { SubtopicNode, TopicNode } from "../report/hooks/useReportState";
import { ReportContext } from "../report/Report";
import { Subtopic, SubtopicHeader } from "../subtopic/Subtopic";

type TopicContextType = {
  topicNode: TopicNode;
};

export const TopicContext = createContext<TopicContextType>({
  topicNode: {} as TopicNode,
});

/**
 * Highest level node in Report. Expands to show subtopics.
 */
function Topic({ node }: { node: TopicNode }) {
  // Get report context and use that to setup scrolling and focusing
  const { useScrollTo, useFocusedNode } = useContext(ReportContext);
  const scrollRef = useScrollTo(node.data.id);
  const focusedRef = useFocusedNode(node.data.id);
  return (
    <TopicContext.Provider value={{ topicNode: node }}>
      <TopicCard ref={mergeRefs([scrollRef, focusedRef])} />
    </TopicContext.Provider>
  );
}
// Empty props type - component only receives ref via forwardRef
type TopicCardProps = object;
/**
 * UI for Topic
 */
const TopicCard = forwardRef<HTMLDivElement, TopicCardProps>(function TopicCard(
  _props: TopicCardProps,
  ref,
) {
  const { topicNode } = useContext(TopicContext);
  const { title, description, summary } = topicNode.data;
  return (
    <Card data-testid={"topic-item"}>
      <CardContent ref={ref}>
        <Col gap={3}>
          <TopicHeader
            button={
              <div className="self-center">
                <CopyLinkButton anchor={title} />
              </div>
            }
          />
          <TopicInteractiveGraphic subtopics={topicNode.children}>
            <ExpandableText>{description}</ExpandableText>
          </TopicInteractiveGraphic>
        </Col>
      </CardContent>
      {/* Topic summary - only render when topic is expanded */}
      {summary && topicNode.isOpen && <TopicSummary summary={summary} />}
      <ExpandTopic />
    </Card>
  );
});

export function TopicHeader({ button }: { button?: React.ReactNode }) {
  const { topicNode } = useContext(TopicContext);
  const { addOns } = useContext(ReportContext);
  const { title } = topicNode.data;
  const subtopics = topicNode.children.map((sub) => sub.data);
  const controversyScore = getTopicControversy(addOns, title);
  const shouldShowControversy = controversyScore !== undefined;

  return (
    <Row gap={2}>
      <CardTitle
        id={`${title}`}
        className="self-center flex-grow"
        data-testid="topic-title"
      >
        {title}
      </CardTitle>
      <div className="flex flex-row items-center text-muted-foreground fill-muted-foreground gap-[6px]">
        <div className="print:hidden">
          <Icons.Claim className="h-4 w-4" />
        </div>
        <p className="p2 text-muted-foreground flex gap-2 items-center ">
          {getNClaims(subtopics)} claims by {getNPeopleFromSubtopics(subtopics)}{" "}
          people
        </p>
        {shouldShowControversy && controversyScore !== undefined && (
          <ControversyIndicator score={controversyScore} showLabel={true} />
        )}
      </div>
      {button}
    </Row>
  );
}

export function TopicContextDescription({
  context,
}: {
  context: string | undefined;
}) {
  return (
    <>
      <Col gap={2} className={`${context === undefined ? "hidden" : "p-8"}`}>
        <h5>More context</h5>
        <p>{context}</p>
      </Col>
      <Separator />
    </>
  );
}

export function TopicSummary({ summary }: { summary: string }) {
  return (
    <Col gap={2} className="px-4 sm:px-8 pb-6 print:px-12 print:py-4">
      <h5 className="print:ml-6">Summary</h5>
      <WordLimitExpandableText
        text={summary}
        wordLimit={180}
        className="print:ml-8"
      />
    </Col>
  );
}

/**
 * Both the claim-cells and the subtopic list. Together here since they interact with one another.
 * ! Can probably be refactored to be simpler.
 */
export function TopicInteractiveGraphic({
  children,
}: React.PropsWithChildren<{
  subtopics: SubtopicNode[];
}>) {
  const { dispatch } = useContext(ReportContext);
  const { topicNode } = useContext(TopicContext);
  const subtopics = topicNode.children.map((sub) => sub.data);
  const [topicsHoverState, onMouseOver, onMouseExit] = useGroupHover(subtopics);
  const buttonBackgroundColor = getThemeColor(topicNode.data.topicColor, "bg");

  return (
    <Col gap={3}>
      {/* Point graphic component */}
      <Row className="gap-x-[3px] gap-y-[3px] flex-wrap print:hidden">
        {topicsHoverState.map(({ group: topic, isHovered }) => (
          <PointGraphicGroup
            key={topic.id}
            claims={topic.claims}
            isHighlighted={isHovered}
          />
        ))}
      </Row>

      {/* anything in between the point graphic and topic links */}
      {children}

      {/* Subtopic links */}
      <Row gap={3} className="space-between print:hidden">
        <SubtopicList
          subtopics={topicsHoverState.map(({ group: topic }) => topic)}
          onMouseOver={onMouseOver}
          onMouseExit={onMouseExit}
        />
        <div className="self-center">
          <Button
            onClick={() =>
              dispatch({
                type: "toggleTopic",
                payload: { id: topicNode.data.id },
              })
            }
            className={buttonBackgroundColor}
            data-testid={"open-topic-button"}
          >
            {topicNode.isOpen ? "Collapse Topic" : "Expand Topic"}
          </Button>
        </div>
      </Row>
    </Col>
  );
}

/**
 * List of subtopics. When hovered should show a popup card and highlight the claim-cells.
 */
export function SubtopicList({
  onMouseOver,
  onMouseExit,
}: {
  subtopics: schema.Subtopic[];
  onMouseOver: (id: string) => void;
  onMouseExit: (id: string) => void;
}) {
  const { topicNode } = useContext(TopicContext);
  const subtopics = topicNode.children.map((sub) => sub.data);

  return (
    <div className="flex items-center flex-grow">
      <span className="line-clamp-2 gap-2 leading-6 p2 text-muted-foreground">
        <Icons.Topic className="inline mr-[6px]" />
        {subtopics.length} subtopics
        {"   "}
        {subtopics.map((subtopic, i) => (
          <SubtopicListItem
            key={subtopic.id}
            subtopic={subtopic}
            withComma={i !== subtopics.length - 1}
            onMouseOver={() => onMouseOver(subtopic.id)}
            onMouseOut={() => onMouseExit(subtopic.id)}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * Single item in a SubtopicList from above.
 */
export function SubtopicListItem({
  subtopic,
  withComma,
  onMouseOut,
  onMouseOver,
}: {
  subtopic: schema.Subtopic;
  withComma: boolean;
  onMouseOver: () => void;
  onMouseOut: () => void;
}) {
  const { dispatch } = useContext(ReportContext);
  const onClick = () =>
    dispatch({ type: "open", payload: { id: subtopic.id } });
  return (
    <HoverCard openDelay={300} closeDelay={0}>
      <HoverCardTrigger onClick={onClick}>
        <span
          role="button"
          tabIndex={0}
          className="cursor-pointer text-muted-foreground text-sm  inline"
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
          onFocus={onMouseOver}
          onBlur={onMouseOut}
        >
          <span className="link" data-testid={"subtopic-list-item"}>
            {subtopic.title}
          </span>
          {withComma ? `,\u00A0\u00A0` : ""}
        </span>
      </HoverCardTrigger>
      <HoverCardContent>
        <Col gap={4}>
          <SubtopicHeader
            title={subtopic.title}
            numClaims={subtopic.claims.length}
            numPeople={getNPeopleFromClaims(subtopic.claims)}
          />
          <p className="text-muted-foreground line-clamp-4">
            {subtopic.description}
          </p>
        </Col>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * When the TopicNode is expanded, show subtopics and handle pagination.
 */
function ExpandTopic() {
  const { topicNode } = useContext(TopicContext);
  const { isOpen, pagination, children: subtopicNodes, data } = topicNode;

  // Check if "Show more" button will be hidden (all subtopics already visible)
  const showMoreButtonHidden =
    isOpen && subtopicNodes.length - 1 - pagination <= 0;

  return (
    <Col>
      {/* Topic context - only render when topic is expanded */}
      {isOpen && data.context && (
        <TopicContextDescription context={data.context} />
      )}
      <Col
        className={`px-3 sm:px-8 gap-y-4 ${showMoreButtonHidden ? "pb-4 sm:pb-8" : ""}`}
      >
        {subtopicNodes.map((node, i) => (
          <Subtopic
            subtopicNode={node}
            topicTitle={data.title}
            topicColor={data.topicColor}
            show={isOpen && i <= pagination}
            key={node.id}
          />
        ))}
      </Col>
      {isOpen && pagination <= subtopicNodes.length && (
        <ShowMoreButton
          moreLeftNum={subtopicNodes.length - 1 - pagination}
          topicId={data.id}
          topicColor={data.topicColor}
        />
      )}
    </Col>
  );
}

function ShowMoreButton({
  moreLeftNum,
  topicId,
  topicColor,
}: {
  moreLeftNum: number;
  topicId: string;
  topicColor: string;
}) {
  const { dispatch } = useContext(ReportContext);
  const bg_color = getThemeColor(topicColor, "bgAccent");
  const text_color = getThemeColor(topicColor, "text");
  const border_color = getThemeColor(topicColor, "border");
  return moreLeftNum > 0 ? (
    <div className="p-4 sm:p-8">
      <Button
        variant={"secondary"}
        className={`${bg_color} ${text_color} ${border_color} border`}
        onClick={() =>
          dispatch({ type: "expandTopic", payload: { id: topicId } })
        }
        data-testid={"show-more-subtopics-button"}
      >
        {moreLeftNum} more subtopic{moreLeftNum > 1 ? "s" : ""}
      </Button>
    </div>
  ) : null;
}

export default Topic;
