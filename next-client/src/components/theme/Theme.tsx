import React from "react";
import { Card, CardContent, CardTitle, TextIcon } from "../elements";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import PointGraphic from "../pointGraphic/PointGraphic";
import DisplayExtendedTheme from "./components/ExtendedTheme";
import Icons from "@src/assets/icons";
import { Col, Row } from "../layout";

function Theme(props: schema.Topic) {
  return (
    <Card>
      <CardContent>
        <Col gap={3}>
          <ThemeHeader title={props.topicName} />
          <ThemeGraphic
            numClaims={props.claimsCount!}
            numPeople={props.subtopics.length}
          />
          <text>{props.topicShortDescription}</text>
          <TopicList
            topics={props.subtopics.map((subtopic) => subtopic.subtopicName)}
          />
          <DisplayExtendedTheme subtopics={props.subtopics} />
        </Col>
      </CardContent>
    </Card>
  );
}

export function ThemeHeader({ title }: { title: string }) {
  return (
    <Row gap={2} className="justify-between">
      <CardTitle className="self-center">
        <a id={`${title}`}>{title}</a>
      </CardTitle>
      <CopyLinkButton anchor={title} />
    </Row>
  );
}

export function ThemeGraphic({
  numClaims,
  numPeople,
}: {
  numClaims: number;
  numPeople: number;
}) {
  return (
    <Col gap={2}>
      <TextIcon icon={<Icons.Claim />}>
        {numClaims} claims by {numPeople} people
      </TextIcon>
      <PointGraphic num={numClaims} />
    </Col>
  );
}

export function TopicList({ topics }: { topics: string[] }) {
  return (
    <Col gap={2} className="pb-2">
      <TextIcon icon={<Icons.Topic />}>{topics.length} topics</TextIcon>

      <text className="text-muted-foreground text-sm">
        <Row gap={2}>
          {topics.map((topic, i) => (
            <span>
              <span className="underline">
                {topic}
                {i !== topics.length - 1 ? "," : ""}
              </span>
            </span>
          ))}
        </Row>
      </text>
    </Col>
  );
}

export default Theme;
