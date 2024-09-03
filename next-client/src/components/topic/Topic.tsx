"use client";

import React, { forwardRef, useContext } from "react";
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Separator,
  TextIcon,
} from "../elements";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { PointGraphicGroup } from "../pointGraphic/PointGraphic";
import Icons from "@src/assets/icons";
import { Col, Row } from "../layout";
import Subtopic, { SubtopicHeader } from "../subtopic/Subtopic";
import { getNClaims, getNPeople } from "tttc-common/morphisms";
import useGroupHover from "../pointGraphic/hooks/useGroupHover";
import { Sticky } from "../wrappers";
import { ReportContext } from "../report/Report";
import { TopicNode } from "../report/hooks/useReportState";
import { mergeRefs } from "react-merge-refs";

/**
 * Highest level node in Report. Expands to show subtopics.
 */
function Topic({ node }: { node: TopicNode }) {
  const { dispatch, useScrollTo, useFocusedNode } = useContext(ReportContext);
  const scrollRef = useScrollTo(node.data.id);
  const focusedRef = useFocusedNode(node.data.id);
  return (
    <TopicCard
      ref={mergeRefs([scrollRef, focusedRef])}
      topic={node.data}
      openButton={
        <Button
          onClick={() =>
            dispatch({ type: "toggleTopic", payload: { id: node.data.id } })
          }
        >
          {node.isOpen ? "Collapse Topic" : "Expand Topic"}
        </Button>
      }
      openedTopic={<ExpandTopic topicNode={node} />}
    />
  );
}
interface TopicCardProps {
  topic: schema.Topic;
  openButton: React.ReactNode;
  openedTopic: React.ReactNode;
}
/**
 * UI for Topic
 */
const TopicCard = forwardRef<HTMLDivElement, TopicCardProps>(function TopicCard(
  { topic, openButton, openedTopic }: TopicCardProps,
  ref,
) {
  const { title, subtopics, description } = topic;

  return (
    <Card>
      <CardContent ref={ref} className="p-2">
        <Col gap={3}>
          <TopicHeader
            title={title}
            button={<CopyLinkButton anchor={title} />}
          />
          <TopicInteractiveGraphic topics={subtopics}>
            <p>{description}</p>
          </TopicInteractiveGraphic>
          <Sticky>{openButton}</Sticky>
        </Col>
      </CardContent>
      {openedTopic}
    </Card>
  );
});

export function TopicHeader({
  title,
  button,
}: {
  title: string;
  button?: React.ReactNode;
}) {
  return (
    <Row gap={2} className="justify-between">
      <CardTitle className="self-center">
        <a id={`${title}`}>{title}</a>
      </CardTitle>
      {button}
    </Row>
  );
}

/**
 * Both the claim-cells and the subtopic list. Together here since they interact with one another.
 * ! Can probably be refactored to be simpler.
 */
export function TopicInteractiveGraphic({
  children,
  topics,
}: React.PropsWithChildren<{ topics: schema.Subtopic[] }>) {
  const [topicsHoverState, onMouseOver, onMouseExit] = useGroupHover(topics);
  return (
    <Col gap={3}>
      <Col gap={2}>
        <TextIcon icon={<Icons.Claim />}>
          {getNClaims(topics)} claims by {getNPeople(topics)} people
        </TextIcon>
        {/* Point graphic component */}
        <Row className="gap-x-[3px] gap-y-[3px] flex-wrap">
          {topicsHoverState.map(({ group: topic, isHovered }) => (
            <PointGraphicGroup
              key={topic.id}
              claims={topic.claims}
              isHighlighted={isHovered}
            />
          ))}
        </Row>
      </Col>

      {/* anything in between the point graphic and topic links */}
      {children}

      {/* Subtopic links */}
      <SubtopicList
        topics={topicsHoverState.map(({ group: topic }) => topic)}
        onMouseOver={onMouseOver}
        onMouseExit={onMouseExit}
      />
    </Col>
  );
}

/**
 * List of subtopics. When hovered should show a popup card and highlight the claim-cells.
 */
export function SubtopicList({
  topics,
  onMouseOver,
  onMouseExit,
}: {
  topics: schema.Subtopic[];
  onMouseOver: (id: string) => void;
  onMouseExit: (id: string) => void;
}) {
  return (
    <Row gap={2} className="flex-wrap">
      <TextIcon icon={<Icons.Topic />}>{topics.length} subtopics</TextIcon>

      {/* <Row gap={2} className="flex-wrap"> */}
      {topics.map((topic, i) => (
        <SubtopicListItem
          key={topic.id}
          topic={topic}
          withComma={i !== topics.length - 1}
          onMouseOver={() => onMouseOver(topic.id)}
          onMouseOut={() => onMouseExit(topic.id)}
        />
      ))}
      {/* </Row> */}
    </Row>
  );
}

/**
 * Single item in a SubtopicList from above.
 */
export function SubtopicListItem({
  topic,
  withComma,
  onMouseOut,
  onMouseOver,
}: {
  topic: schema.Subtopic;
  withComma: boolean;
  onMouseOver: () => void;
  onMouseOut: () => void;
}) {
  return (
    <HoverCard openDelay={300} closeDelay={0}>
      <HoverCardTrigger>
        <p
          className="cursor-pointer text-muted-foreground text-sm"
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
        >
          <span className="link">
            {topic.title}
            {withComma ? "," : ""}
          </span>
        </p>
      </HoverCardTrigger>
      <HoverCardContent>
        <Col gap={4}>
          <SubtopicHeader
            title={topic.title}
            numClaims={topic.claims.length}
            numPeople={getNPeople(topic.claims)}
          />
          <p className="text-muted-foreground">{topic.description}</p>
        </Col>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * When the TopicNode is expanded, show subtopics and handle pagination.
 */
function ExpandTopic({ topicNode }: { topicNode: TopicNode }) {
  const { isOpen, pagination, children: topicNodes, data } = topicNode;

  return (
    <>
      <Separator className={`${isOpen ? "" : "hidden"}`} />
      {topicNodes.map((node, i) => (
        <Col key={node.data.id}>
          <Subtopic node={node} isOpen={isOpen && i + 1 <= pagination} />
        </Col>
      ))}
      {isOpen && pagination <= topicNodes.length && (
        <>
          <Separator />
          <ShowMoreButton
            moreLeftNum={topicNodes.length - pagination}
            topicId={data.id}
          />
        </>
      )}
    </>
  );
}

function ShowMoreButton({
  moreLeftNum,
  topicId,
}: {
  moreLeftNum: number;
  topicId: string;
}) {
  const { dispatch } = useContext(ReportContext);
  return moreLeftNum > 0 ? (
    <div className="p-4 sm:p-8">
      <Button
        variant={"secondary"}
        onClick={() =>
          dispatch({ type: "expandTopic", payload: { id: topicId } })
        }
      >
        {moreLeftNum} more subtopics{moreLeftNum > 1 ? "s" : ""}
      </Button>
    </div>
  ) : null;
}

export default Topic;
