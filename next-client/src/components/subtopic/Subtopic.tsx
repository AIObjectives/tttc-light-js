import React, { forwardRef, useContext } from "react";
import * as schema from "tttc-common/schema";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { ExpandableText, TextIcon } from "../elements";
import PointGraphic from "../pointGraphic/PointGraphic";
import { Claim } from "../claim";
import { Col, Row } from "../layout";
import Icons from "@/assets/icons";
import ClaimLoader from "./components/ClaimLoader";
import { getNPeople } from "tttc-common/morphisms";
import { ClaimNode, SubtopicNode } from "../report/hooks/useReportState";
import { ClaimItem } from "../claim/ClaimItem";
import { ReportContext } from "../report/Report";
import { mergeRefs } from "react-merge-refs";

/**
 * Second highest level node in a Report. Expands to show claims.
 */
export function Subtopic({
  subtopicNode,
  show,
}: {
  subtopicNode: SubtopicNode;
  show: boolean;
}) {
  const { useScrollTo, useFocusedNode, dispatch } = useContext(ReportContext);

  const scrollRef = useScrollTo(subtopicNode.data.id);
  const focusedRef = useFocusedNode(subtopicNode.data.id, !show);
  if (!show) {
    return <></>;
  }
  return (
    <SubtopicCard
      subtopicNode={subtopicNode}
      ref={mergeRefs([scrollRef, focusedRef])}
      onExpandSubtopic={() =>
        dispatch({ type: "expandSubtopic", payload: { id: subtopicNode.id } })
      }
    />
  );
}

/**
 * UI for subtopic
 */
export const SubtopicCard = forwardRef<
  HTMLDivElement,
  { subtopicNode: SubtopicNode; onExpandSubtopic: () => void }
>(function TopicComponent({ subtopicNode, onExpandSubtopic }, ref) {
  return (
    <div data-testid={"subtopic-item"}>
      <Col gap={4} className="py-3 sm:py-8 border rounded-[8px]" ref={ref}>
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
      <p className="leading-6 pl-4 md:pl-8 text-base font-medium">Claims</p>
      <Col gap={4}>
        <Col>
          {claimNodes.map((claimNode, i) => {
            return (
              <ClaimItem
                key={claimNode.id}
                show={i <= pagination}
                id={claimNode.id}
              >
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
