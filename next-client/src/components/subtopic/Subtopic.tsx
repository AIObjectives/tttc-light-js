import React, { forwardRef, useContext } from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { ExpandableText, Separator, TextIcon } from "../elements";
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
      {isOpen && <SubtopicComponent subtopicNode={node} />}
    </div>
  );
}

/**
 * UI for subtopic
 */
const SubtopicComponent = forwardRef<
  HTMLDivElement,
  { subtopicNode: SubtopicNode }
>(function TopicComponent({ subtopicNode }, ref) {
  return (
    <div>
      <Col gap={4} className="py-6 sm:py-8" ref={ref}>
        <SubtopicSummary subtopic={subtopicNode.data} />
        <SubtopicClaims subtopicNode={subtopicNode} />
      </Col>
      <Separator />
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
        <h5>
          <a id={`${title}`}>{title}</a>
        </h5>
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
    <ExpandableText className="text-muted-foreground">
      {description}
    </ExpandableText>
  );
}

export function SubtopicSummary({ subtopic }: { subtopic: schema.Subtopic }) {
  const { title, claims, description } = subtopic;
  // ! Temp change for QA testing
  const nPeople = Math.floor(getNPeople(claims) * 0.45);
  return (
    <Col gap={4} className="px-4 sm:px-8">
      <SubtopicHeader
        title={title}
        numClaims={claims.length}
        numPeople={nPeople}
        button={<CopyLinkButton anchor={title} />}
      />
      <PointGraphic claims={subtopic.claims} />
      <SubtopicDescription description={description!} />
    </Col>
  );
}

export function SubtopicClaims({
  subtopicNode,
}: {
  subtopicNode: SubtopicNode;
}) {
  return (
    <Col gap={4}>
      <Col>
        {subtopicNode.children.map((claimNode, i) => {
          return (
            <Claim
              key={claimNode.data.id}
              claimNode={claimNode}
              show={i < subtopicNode.pagination}
            />
          );
        })}
      </Col>
      <ClaimLoader subtopicNode={subtopicNode} />
    </Col>
  );
}

export default Subtopic;
