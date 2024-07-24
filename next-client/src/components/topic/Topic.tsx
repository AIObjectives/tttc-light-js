import React, { forwardRef, useContext } from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { TextIcon } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import Claim from "../claim/Claim";
import { Col, Row } from "../layout";
import Icons from "@src/assets/icons";
import ClaimLoader from "./components/ClaimLoader";
import { getNPeople } from "tttc-common/morphisms";
import { TopicNode } from "@src/types";
import { ReportContext } from "../report/Report";

function Topic({ node, isOpen }: { node: TopicNode; isOpen: boolean }) {
  const { useScrollTo } = useContext(ReportContext);

  const ref = useScrollTo(node.data.id);

  return <div ref={ref}>{isOpen && <TopicComponent topic={node.data} />}</div>;
}

const TopicComponent = forwardRef<HTMLDivElement, { topic: schema.Topic }>(
  function TopicComponent({ topic }, ref) {
    return (
      <div>
        <Col gap={4} className="py-6 sm:py-8" ref={ref}>
          <TopicSummary topic={topic} />
          <TopicClaims claims={topic.claims} />
        </Col>
      </div>
    );
  },
);

export function TopicHeader({
  title,
  numClaims,
  numPeople,
  button,
}: {
  title: string;
  numClaims: number;
  numPeople: number;
  button?: React.ReactNode;
}) {
  return (
    <Row gap={4} className="justify-between items-center">
      <div className="flex flex-grow">
        <h4>
          <a id={`${title}`}>{title}</a>
        </h4>
      </div>
      <TextIcon icon={<Icons.Claim />}>
        {numClaims} claims by {numPeople} people
      </TextIcon>
      {button}
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
  const nPeople = getNPeople(claims);
  return (
    <Col gap={4} className="px-4 sm:px-8">
      <TopicHeader
        title={title}
        numClaims={claims.length}
        numPeople={nPeople}
        button={<CopyLinkButton anchor={title} />}
      />
      <PointGraphic claims={topic.claims} />
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
