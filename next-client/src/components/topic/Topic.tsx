"use client";

import React, { forwardRef, useContext } from "react";
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
import { SubtopicNode, TopicNode } from "../report/hooks/useReportState";
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
      topicNode={node}
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
  topicNode: TopicNode;
  openButton: React.ReactNode;
  openedTopic: React.ReactNode;
}
/**
 * UI for Topic
 */
const TopicCard = forwardRef<HTMLDivElement, TopicCardProps>(function TopicCard(
  { topicNode, openButton, openedTopic }: TopicCardProps,
  ref,
) {
  const { title, description } = topicNode.data;

  return (
    <Card>
      <CardContent ref={ref} className="p-2">
        <Col gap={3}>
          <TopicHeader
            title={title}
            button={<CopyLinkButton anchor={title} />}
          />
          <TopicInteractiveGraphic
            subtopics={topicNode.children}
            openButton={openButton}
          >
            <ExpandableText>{description}</ExpandableText>
          </TopicInteractiveGraphic>
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
  subtopics,
  openButton,
}: React.PropsWithChildren<{
  subtopics: SubtopicNode[];
  openButton: React.ReactNode;
}>) {
  const [topicsHoverState, onMouseOver, onMouseExit] = useGroupHover(
    subtopics.map((node) => node.data),
  );
  return (
    <Col gap={3}>
      <Col gap={2}>
        <TextIcon icon={<Icons.Claim />}>
          {getNClaims(subtopics.map((node) => node.data))} claims by{" "}
          {/* ! Temp change for QA testing */}
          {Math.floor(
            getNPeople(subtopics.map((node) => node.data)) * 0.45,
          )}{" "}
          people
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
      <Row gap={3} className="space-between">
        <SubtopicList
          subtopics={topicsHoverState.map(({ group: topic }) => topic)}
          onMouseOver={onMouseOver}
          onMouseExit={onMouseExit}
        />
        <div className="self-center">{openButton}</div>
      </Row>
    </Col>
  );
}

/**
 * List of subtopics. When hovered should show a popup card and highlight the claim-cells.
 */
export function SubtopicList({
  subtopics,
  onMouseOver,
  onMouseExit,
}: {
  subtopics: schema.Subtopic[];
  onMouseOver: (id: string) => void;
  onMouseExit: (id: string) => void;
}) {
  return (
    <p className="line-clamp-2 leading-6 flex-grow">
      <TextIcon className="inline" icon={<Icons.Topic className="inline " />}>
        {subtopics.length} subtopics
      </TextIcon>
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
    </p>
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
        <p
          className="cursor-pointer text-muted-foreground text-sm  inline"
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
        >
          <span className="link">{subtopic.title}</span>
          {withComma ? ",   " : ""}
        </p>
      </HoverCardTrigger>
      <HoverCardContent>
        <Col gap={4}>
          <SubtopicHeader
            title={subtopic.title}
            numClaims={subtopic.claims.length}
            numPeople={getNPeople(subtopic.claims)}
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
        {moreLeftNum} more subtopic{moreLeftNum > 1 ? "s" : ""}
      </Button>
    </div>
  ) : null;
}

export default Topic;
