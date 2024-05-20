import React from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { CardDescription } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import Claim from "../claim/Claim";
import { Col, Row } from "../layout";

function Topic({ subtopic }: { subtopic: schema.Subtopic }) {
  const { subtopicName, claims, claimsCount, subtopicShortDescription } =
    subtopic;
  return (
    <Col gap={4}>
      <TopicHeader
        title={subtopicName}
        numClaims={claimsCount!}
        numPeople={claims!.length}
      />
      <PointGraphic num={claims!.length} />
      <TopicDescription description={subtopicShortDescription!} />
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
    <Row gap={0} className="justify-between items-center">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="flex flex-row">
        <CardDescription className="self-center mr-4">
          {numClaims} claims by {numPeople} people
        </CardDescription>
        <CopyLinkButton anchor={title} />
      </div>
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

export function TopicClaims({ claims }: { claims: schema.Claim[] }) {
  return (
    <div className="flex flex-col gap-y-6">
      {claims.map((claim, i) => {
        // ! Something wrong with quotes here
        return (
          <Claim claimNum={i} title={claim.topicName} quotes={[claim.quote]} />
        );
      })}
    </div>
  );
}

export default Topic;
