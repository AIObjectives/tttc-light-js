import React from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { TextIcon } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import Claim from "../claim/Claim";
import { Col, Row } from "../layout";
import Icons from "@src/assets/icons";
import ClaimLoader from "./components/ClaimLoader";

function Topic({ topic }: { topic: schema.Topic }) {
  const { claims } = topic;
  return (
    <Col gap={4} className="py-6 sm:py-8">
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
        <h4>{title}</h4>
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
    <Col gap={4} className="px-4 sm:px-8">
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
  const pagination = 3;
  const i = pagination;
  return (
    <>
      {claims.slice(0, pagination).map((claim, i) => {
        return (
          <Claim claimNum={i + 1} title={claim.title} quotes={claim.quotes} />
        );
      })}
      <ClaimLoader
        claims={claims.slice(pagination)}
        pagination={pagination}
        i={i}
      />
    </>
  );
}

export default Topic;
