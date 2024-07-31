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

function Topic({ node }: { node: TopicNode }) {
  const { dispatch, useScrollTo } = useContext(ReportContext);
  const ref = useScrollTo(node.data.id);
  return (
    <TopicCard
      ref={ref}
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
const TopicCard = forwardRef<HTMLDivElement, TopicCardProps>(function TopicCard(
  { topic, openButton, openedTopic }: TopicCardProps,
  ref,
) {
  const { title, subtopics, description } = topic;

  return (
    <Card ref={ref}>
      <CardContent className="p-2">
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
        <Row className="gap-x-[3px]">
          {topicsHoverState.map(({ group: topic, isHovered }) => (
            <PointGraphicGroup
              claims={topic.claims}
              isHighlighted={isHovered}
            />
          ))}
        </Row>
      </Col>

      {/* anything in between the point graphic and topic links */}
      {children}

      {/* Topic links */}
      <TopicList
        topics={topicsHoverState.map(({ group: topic }) => topic)}
        onMouseOver={onMouseOver}
        onMouseExit={onMouseExit}
      />
    </Col>
  );
}

export function TopicList({
  topics,
  onMouseOver,
  onMouseExit,
}: {
  topics: schema.Subtopic[];
  onMouseOver: (id: string) => void;
  onMouseExit: (id: string) => void;
}) {
  return (
    <Col gap={2} className="pb-2">
      <TextIcon icon={<Icons.Topic />}>{topics.length} subtopics</TextIcon>

      <Row gap={2}>
        {topics.map((topic, i) => (
          <TopicListItem
            topic={topic}
            withComma={i !== topics.length - 1}
            onMouseOver={() => onMouseOver(topic.id)}
            onMouseOut={() => onMouseExit(topic.id)}
          />
        ))}
      </Row>
      {/* </p> */}
    </Col>
  );
}

export function TopicListItem({
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
        <span
          className="cursor-pointer"
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
        >
          <span className="link">
            {topic.title}
            {withComma ? "," : ""}
          </span>
        </span>
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

function ExpandTopic({ topicNode }: { topicNode: TopicNode }) {
  const { isOpen, pagination, children: topicNodes, data } = topicNode;

  return (
    <>
      <Separator className={`${isOpen ? "" : "hidden"}`} />
      {topicNodes.map((node, i) => (
        <Col>
          <Subtopic node={node} isOpen={isOpen && i + 1 <= pagination} />
        </Col>
      ))}
      {isOpen && pagination <= topicNodes.length && (
        <ShowMoreButton
          moreLeftNum={topicNodes.length - pagination}
          topicId={data.id}
        />
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
