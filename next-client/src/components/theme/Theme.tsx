"use client";

import React, { useReducer } from "react";
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
import { getNPeople } from "@src/lib/utils/morphisms";

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

type TopicHoverState = { isHovered: boolean; topic: schema.Topic };
const stateReplace = (
  state: TopicHoverState[],
  idx: number,
  value: boolean,
): TopicHoverState[] => [
  ...state.slice(0, idx),
  { ...state[idx], isHovered: value },
  ...state.slice(idx + 1),
];
const safeFindIdx = (state: TopicHoverState[], id: string): number => {
  const idx = state.findIndex((val) => val.topic.id === id);
  if (idx === -1) throw new Error("could not find idx to in topicHoverReducer");
  return idx;
};
const stateFindAndReplace =
  (value: boolean) =>
  (state: TopicHoverState[], id: string): TopicHoverState[] =>
    stateReplace(state, safeFindIdx(state, id), value);
const onMouseOver = stateFindAndReplace(true);
const onMouseExit = stateFindAndReplace(false);
type TopicHoverActions = "mouseOver" | "mouseExit";
type TopicHoverPayload = { id: string };
const topicHoverReducer = (
  state: TopicHoverState[],
  action: { type: TopicHoverActions; payload: TopicHoverPayload },
) =>
  action.type === "mouseOver"
    ? onMouseOver(state, action.payload.id)
    : onMouseExit(state, action.payload.id);

export function ThemeInteractiveGraphic({
  children,
  topics,
}: React.PropsWithChildren<{ topics: schema.Topic[] }>) {
  const [topicsHoverState, setTopicsHoverState] = useReducer(
    topicHoverReducer,
    topics.map((topic) => ({ isHovered: false, topic })),
  );
  return (
    <Col gap={3}>
      {/* Point graphic component */}
      <Row className="gap-x-[3px]">
        {topicsHoverState.map(({ topic, isHovered }) => (
          <PointGraphicGroup claims={topic.claims} isHighlighted={isHovered} />
        ))}
      </Row>

      {/* anything in between the point graphic and topic links */}
      {children}

      {/* Topic links */}
      <TopicList
        topics={topicsHoverState.map(({ topic }) => topic)}
        mouseEvent={setTopicsHoverState}
      />
    </Col>
  );
}

export function TopicList({
  topics,
  mouseEvent,
}: {
  topics: schema.Topic[];
  mouseEvent: React.Dispatch<{
    type: TopicHoverActions;
    payload: TopicHoverPayload;
  }>;
}) {
  return (
    <Col gap={2} className="pb-2">
      <TextIcon icon={<Icons.Topic />}>{topics.length} topics</TextIcon>

      <p className="text-muted-foreground">
        <Row gap={2}>
          {topics.map((topic, i) => (
            <TopicListItem
              topic={topic}
              withComma={i !== topics.length - 1}
              onMouseOver={() =>
                mouseEvent({ type: "mouseOver", payload: { id: topic.id } })
              }
              onMouseOut={() =>
                mouseEvent({ type: "mouseExit", payload: { id: topic.id } })
              }
            />
          ))}
        </Row>
      </p>
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
    <HoverCard>
      <HoverCardTrigger>
        <span
          className="cursor-pointer"
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
        >
          <span className="underline">
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
