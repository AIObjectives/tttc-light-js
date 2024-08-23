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
import { ReportContext } from "../report/Report";
import { SubtopicNode } from "../report/hooks/useReportState";
import { mergeRefs } from "react-merge-refs";

/**
 * Subtopic Node. Only show contents if isOpen=true.
 */
function Subtopic({ node, isOpen }: { node: SubtopicNode; isOpen: boolean }) {
  const { useScrollTo, useFocusedNode } = useContext(ReportContext);

  const scrollRef = useScrollTo(node.data.id);
  const focusedRef = useFocusedNode(node.data.id, !isOpen);

  return (
    <div ref={mergeRefs([scrollRef, focusedRef])}>
      {isOpen && <SubtopicComponent topic={node.data} />}
    </div>
  );
}

/**
 * UI for subtopic
 */
const SubtopicComponent = forwardRef<
  HTMLDivElement,
  { topic: schema.Subtopic }
>(function TopicComponent({ topic }, ref) {
  return (
    <div>
      <Col gap={4} className="py-6 sm:py-8" ref={ref}>
        <SubtopicSummary topic={topic} />
        <SubtopicClaims claims={topic.claims} />
      </Col>
    </div>
  );
});

export function SubtopicHeader({
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

export function SubtopicDescription({ description }: { description: string }) {
  return (
    <div>
      <p>{description}</p>
    </div>
  );
}

export function SubtopicSummary({ topic }: { topic: schema.Subtopic }) {
  const { title, claims, description } = topic;
  const nPeople = getNPeople(claims);
  return (
    <Col gap={4} className="px-4 sm:px-8">
      <SubtopicHeader
        title={title}
        numClaims={claims.length}
        numPeople={nPeople}
        button={<CopyLinkButton anchor={title} />}
      />
      <PointGraphic claims={topic.claims} />
      <SubtopicDescription description={description!} />
    </Col>
  );
}

export function SubtopicClaims({ claims }: { claims: schema.Claim[] }) {
  const pagination = 3;
  const i = pagination;
  return (
    <>
      {claims.slice(0, pagination).map((claim, i) => {
        return (
          <Claim
            key={claim.id}
            claimNum={i + 1}
            title={claim.title}
            quotes={claim.quotes}
          />
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

export default Subtopic;
