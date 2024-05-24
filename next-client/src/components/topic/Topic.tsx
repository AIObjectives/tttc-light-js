import React from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { CardDescription, TextIcon } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import Claim from "../claim/Claim";
import { Col, Row } from "../layout";
import Icons from "@src/assets/icons";

function Topic({ subtopic }: { subtopic: schema.Subtopic }) {
  const { subtopicName, claims, claimsCount, subtopicShortDescription } =
    subtopic;
  return (
    <Col gap={4}>
      <TopicSummary subtopic={subtopic} />
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
    <Row gap={2} className="justify-between items-center">
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

export function TopicSummary({ subtopic }: { subtopic: schema.Subtopic }) {
  const { subtopicName, claims, claimsCount, subtopicShortDescription } =
    subtopic;
  return (
    <Col gap={4} className="px-8 pt-8">
      <TopicHeader
        title={subtopicName}
        numClaims={claimsCount!}
        numPeople={claims!.length}
      />
      <PointGraphic num={claims!.length} />
      <TopicDescription description={subtopicShortDescription!} />
    </Col>
  );
}

export function TopicClaims({ claims }: { claims: schema.Claim[] }) {
  return (
    <Col gap={4}>
      {claims.map((claim, i) => {
        // ! Something wrong with quotes here
        return (
          <Claim claimNum={i} title={claim.topicName} quotes={[claim.quote]} />
        );
      })}
    </Col>
  );
}

export default Topic;
