import React from "react";
import { CardTitle, TextIcon } from "../elements";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import PointGraphic from "../pointGraphic/PointGraphic";
import Icons from "@src/assets/icons";
import { Col, Row } from "../layout";
import ThemeWrapper from "./components/ThemeWrapper";

function Theme(props: schema.Theme) {
  const { title, topics, description } = props;
  const claims: schema.Claim[] = topics.flatMap((topic) => topic.claims);

  return (
    <ThemeWrapper topics={topics} description={description}>
      <ThemeHeader title={title} />
      <ThemeGraphic
        numClaims={claims.length}
        numPeople={0} // todo Figure out how to do this
      />
      <text>{description}</text>
      <TopicList topics={topics.map((topic) => topic.title)} />
    </ThemeWrapper>
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
