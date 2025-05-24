import React, { forwardRef, useContext } from "react";
import * as schema from "tttc-common/schema";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { ExpandableText, Separator, TextIcon } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import { Claim } from "../claim";
import { Col, Row } from "../layout";
import Icons from "@/assets/icons";
import ClaimLoader from "./components/ClaimLoader";
import { getNPeople } from "tttc-common/morphisms";
import { ReportContext } from "../report/Report";
import { SubtopicNode } from "../report/hooks/useReportState";
import { mergeRefs } from "react-merge-refs";
import { NodeWrapper } from "../node/NodeWrapper";

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
    <div data-testid={"subtopic-item"}>
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
  return <ExpandableText>{description}</ExpandableText>;
}

export function SubtopicSummary({ subtopic }: { subtopic: schema.Subtopic }) {
  const { title, claims, description } = subtopic;
  return (
    <Col gap={4} className="px-4 sm:px-8">
      <SubtopicHeader
        title={title}
        numClaims={claims.length}
        numPeople={getNPeople(claims)}
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
    <Col>
      <p className="leading-6 pl-8 text-base font-medium">Claims</p>
      <Col gap={4}>
        <Col>
          {subtopicNode.children.map((claimNode, i) => {
            return (
              <NodeWrapper
                key={claimNode.id}
                node={claimNode}
                className={`${i <= subtopicNode.pagination ? "" : "hidden"}`}
              >
                <Claim claim={claimNode.data} />
              </NodeWrapper>
            );
          })}
        </Col>
        <ClaimLoader subtopicNode={subtopicNode} />
      </Col>
    </Col>
  );
}

export default Subtopic;
