import React from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { CardDescription, TextIcon } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import Claim from "../claim/Claim";
import { Col, Row } from "../layout";
import Icons from "@src/assets/icons";

function Topic({ topic }: { topic: schema.Topic }) {
  const { title, claims, description } = topic;
  return (
    <Col gap={4}>
      <TopicSummary topic={topic} />
      <TopicClaims claims={claims!} />
    </Col>
  );
}

export function TopicHeader({
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
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <TextIcon icon={<Icons.Claim />}>
        {numClaims} claims by {numPeople} people
      </TextIcon>
      <CopyLinkButton anchor={title} />
    </Row>
  );
}

export function TopicDescription({ description }: { description: string }) {
  return (
    <div>
      <p>{description}</p>
    </div>
  );
}

export function TopicSummary({ topic }: { topic: schema.Topic }) {
  const { title, claims, description } = topic;
  return (
    <Col gap={4} className="px-8 pt-8">
      <TopicHeader
        title={title}
        numClaims={claims.length}
        numPeople={claims!.length}
      />
      <PointGraphic num={claims!.length} />
      <TopicDescription description={description!} />
    </Col>
  );
}

export function TopicClaims({ claims }: { claims: schema.Claim[] }) {
  return (
    <Col gap={4}>
      {claims.map((claim, i) => {
        return <Claim claimNum={i} title={claim.title} quotes={claim.quotes} />;
      })}
    </Col>
  );
}

export default Topic;
