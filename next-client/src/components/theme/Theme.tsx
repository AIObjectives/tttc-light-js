"use client";

import React from "react";
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  TextIcon,
} from "../elements";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { PointGraphicGroup } from "../pointGraphic/PointGraphic";
import Icons from "@src/assets/icons";
import { Col, Row } from "../layout";
import ExtendedTheme from "./components/ExtendedTheme";
import { TopicHeader } from "../topic/Topic";
import { getNClaims, getNPeople } from "tttc-common/morphisms";
import useGroupHover from "../pointGraphic/hooks/useGroupHover";

function Theme({
  theme,
  isOpen,
  setIsOpen,
}: {
  theme: schema.Theme;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}) {
  const { title, topics, description } = theme;

  return (
    <Card>
      <CardContent>
        <Col gap={3}>
          <ThemeHeader
            title={title}
            button={<CopyLinkButton anchor={title} />}
          />
          <ThemeInteractiveGraphic topics={topics}>
            <p>{description}</p>
          </ThemeInteractiveGraphic>
          <div>
            <Button onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? "Collapse Theme" : "Extend Theme"}
            </Button>
          </div>
        </Col>
      </CardContent>
      {isOpen ? <ExtendedTheme topics={topics} /> : null}
    </Card>
  );
}

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

      {/* <p className="text-muted-foreground"> */}
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

export default Theme;
