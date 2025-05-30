import React, { forwardRef } from "react";
import * as schema from "tttc-common/schema";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { ExpandableText, Separator, TextIcon } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import { Claim } from "../claim";
import { Col, Row } from "../layout";
import Icons from "@/assets/icons";
import ClaimLoader from "./components/ClaimLoader";
import { getNPeople } from "tttc-common/morphisms";
import { ClaimNode, SubtopicNode } from "../report/hooks/useReportState";
import { ClaimItem } from "../claim/ClaimItem";

/**
 * UI for subtopic
 */
export const Subtopic = forwardRef<
  HTMLDivElement,
  { subtopicNode: SubtopicNode; onExpandSubtopic: () => void }
>(function TopicComponent({ subtopicNode, onExpandSubtopic }, ref) {
  return (
    <div data-testid={"subtopic-item"}>
      <Col gap={4} className="py-6 sm:py-8" ref={ref}>
        <SubtopicSummary
          title={subtopicNode.data.title}
          description={subtopicNode.data.description}
          claims={subtopicNode.data.claims}
        />
        <SubtopicClaims
          claimNodes={subtopicNode.children}
          pagination={subtopicNode.pagination}
          onExpandSubtopic={onExpandSubtopic}
        />
      </Col>
      <Separator />
    </div>
  );
});

export function SubtopicHeader({
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
        <h5>
          <a id={`${title}`}>{title}</a>
        </h5>
      </div>
      <TextIcon icon={<Icons.Claim />}>
        {numClaims} claims by {numPeople} people
      </TextIcon>
      <CopyLinkButton anchor={title} />
    </Row>
  );
}

export function SubtopicDescription({ description }: { description: string }) {
  return <ExpandableText>{description}</ExpandableText>;
}

export function SubtopicSummary({
  title,
  claims,
  description,
}: {
  title: string;
  claims: schema.Claim[];
  description: string;
}) {
  return (
    <Col gap={4} className="px-4 sm:px-8">
      <SubtopicHeader
        title={title}
        numClaims={claims.length}
        numPeople={getNPeople(claims)}
      />
      <PointGraphic claims={claims} />
      <SubtopicDescription description={description!} />
    </Col>
  );
}

export function SubtopicClaims({
  claimNodes,
  onExpandSubtopic,
  pagination,
}: {
  claimNodes: ClaimNode[];
  pagination: number;
  onExpandSubtopic: () => void;
}) {
  return (
    <Col>
      <p className="leading-6 pl-8 text-base font-medium">Claims</p>
      <Col gap={4}>
        <Col>
          {claimNodes.map((claimNode, i) => {
            return (
              <ClaimItem show={i <= pagination} id={claimNode.id}>
                <Claim claim={claimNode.data} />
              </ClaimItem>
            );
          })}
        </Col>
        <ClaimLoader
          remaining={claimNodes.length - pagination - 1}
          onExpandSubtopic={onExpandSubtopic}
        />
      </Col>
    </Col>
  );
}

export default Subtopic;
