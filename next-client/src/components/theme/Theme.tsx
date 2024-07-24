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
import Topic, { TopicHeader } from "../topic/Topic";
import { getNClaims, getNPeople } from "tttc-common/morphisms";
import useGroupHover from "../pointGraphic/hooks/useGroupHover";
import { Sticky } from "../wrappers";
import { ThemeNode } from "@src/types";
import { ReportContext } from "../report/Report";

function Theme({ node }: { node: ThemeNode }) {
  const { dispatch, useScrollTo } = useContext(ReportContext);
  const ref = useScrollTo(node.data.id);
  return (
    <ThemeCard
      ref={ref}
      theme={node.data}
      openButton={
        <Button
          onClick={() =>
            dispatch({ type: "toggleTheme", payload: { id: node.data.id } })
          }
        >
          {node.isOpen ? "Collapse Theme" : "Extend Theme"}
        </Button>
      }
      openedTheme={<ExpandThemed themeNode={node} />}
    />
  );
}
interface ThemeCardProps {
  theme: schema.Theme;
  openButton: React.ReactNode;
  openedTheme: React.ReactNode;
}
const ThemeCard = forwardRef<HTMLDivElement, ThemeCardProps>(function ThemeCard(
  { theme, openButton, openedTheme }: ThemeCardProps,
  ref,
) {
  const { title, topics, description } = theme;

  return (
    <Card ref={ref}>
      <CardContent>
        <Col gap={3}>
          <ThemeHeader
            title={title}
            button={<CopyLinkButton anchor={title} />}
          />
          <ThemeInteractiveGraphic topics={topics}>
            <p>{description}</p>
          </ThemeInteractiveGraphic>
          <Sticky>{openButton}</Sticky>
        </Col>
      </CardContent>
      {openedTheme}
    </Card>
  );
});

export function ThemeHeader({
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

export function ThemeInteractiveGraphic({
  children,
  topics,
}: React.PropsWithChildren<{ topics: schema.Topic[] }>) {
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
  topics: schema.Topic[];
  onMouseOver: (id: string) => void;
  onMouseExit: (id: string) => void;
}) {
  return (
    <Col gap={2} className="pb-2">
      <TextIcon icon={<Icons.Topic />}>{topics.length} topics</TextIcon>

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
  topic: schema.Topic;
  withComma: boolean;
  onMouseOver: () => void;
  onMouseOut: () => void;
}) {
  return (
    <HoverCard openDelay={0} closeDelay={0}>
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
          <TopicHeader
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

function ExpandThemed({ themeNode }: { themeNode: ThemeNode }) {
  const { isOpen, pagination, children: topicNodes, data } = themeNode;

  return (
    <>
      <Separator className={`${isOpen ? "" : "hidden"}`} />
      {topicNodes.map((node, i) => (
        <Col>
          <Topic node={node} isOpen={isOpen && i + 1 <= pagination} />
        </Col>
      ))}
      {isOpen && pagination <= topicNodes.length && (
        <ShowMoreButton
          moreLeftNum={topicNodes.length - pagination}
          themeId={data.id}
        />
      )}
    </>
  );
}

function ShowMoreButton({
  moreLeftNum,
  themeId,
}: {
  moreLeftNum: number;
  themeId: string;
}) {
  const { dispatch } = useContext(ReportContext);
  return moreLeftNum > 0 ? (
    <div className="p-4 sm:p-8">
      <Button
        variant={"secondary"}
        onClick={() =>
          dispatch({ type: "expandTheme", payload: { id: themeId } })
        }
      >
        {moreLeftNum} more topic{moreLeftNum > 1 ? "s" : ""}
      </Button>
    </div>
  ) : null;
}

export default Theme;
