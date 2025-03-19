"use client";

import React, { createContext, forwardRef, useContext } from "react";
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  ExpandableText,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Separator,
  TextIcon,
} from "../elements";
import * as schema from "tttc-common/schema";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { PointGraphicGroup } from "../pointGraphic/PointGraphic";
import Icons from "@/assets/icons";
import { Col, Row } from "../layout";
import Subtopic, { SubtopicHeader } from "../subtopic/Subtopic";
import { getNClaims, getNPeople } from "tttc-common/morphisms";
import useGroupHover from "../pointGraphic/hooks/useGroupHover";
import { ReportContext } from "../report/Report";
import { SubtopicNode, TopicNode } from "../report/hooks/useReportState";
import { mergeRefs } from "react-merge-refs";
import { useThemeColor } from "@/lib/hooks/useTopicTheme";

type TopicContextType = {
  topicNode: TopicNode;
};

export const TopicContext = createContext<TopicContextType>({
  topicNode: {} as TopicNode,
});

/**
 * Highest level node in Report. Expands to show subtopics.
 */
function Topic({ node }: { node: TopicNode }) {
  // Get report context and use that to setup scrolling and focusing
  const { useScrollTo, useFocusedNode } = useContext(ReportContext);
  const scrollRef = useScrollTo(node.data.id);
  const focusedRef = useFocusedNode(node.data.id);
  return (
    <TopicContext.Provider value={{ topicNode: node }}>
      <TopicCard ref={mergeRefs([scrollRef, focusedRef])} />
    </TopicContext.Provider>
  );
}
interface TopicCardProps {}
/**
 * UI for Topic
 */
const TopicCard = forwardRef<HTMLDivElement, TopicCardProps>(function TopicCard(
  {}: TopicCardProps,
  ref,
) {
  const { topicNode } = useContext(TopicContext);
  const { title, description } = topicNode.data;

  return (
    <Card>
      <CardContent ref={ref}>
        <Col gap={3}>
          <TopicHeader
            button={
              <>
                <div className="self-center">
                  <CopyLinkButton anchor={title} />
                </div>
              </>
            }
          />
          <TopicInteractiveGraphic subtopics={topicNode.children}>
            <ExpandableText>{description}</ExpandableText>
          </TopicInteractiveGraphic>
        </Col>
      </CardContent>
      <ExpandTopic />
    </Card>
  );
});

export function TopicHeader({ button }: { button?: React.ReactNode }) {
  const { topicNode } = useContext(TopicContext);
  const { title } = topicNode.data;
  const subtopics = topicNode.children.map((sub) => sub.data);
  return (
    <Row gap={2}>
      <CardTitle className="self-center flex-grow">
        <a id={`${title}`}>{title}</a>
      </CardTitle>
      {/* <TextIcon
        icon={
          // <div>
          <Icons.Claim />
          // </div>
        }
      >
        {getNClaims(subtopics)} claims by {getNPeople(subtopics)} people
      </TextIcon> */}
      <Row
        gap={2}
        className="items-center text-muted-foreground fill-muted-foreground"
      >
        <div>
          <Icons.Claim className="h-4 w-4" />
        </div>
        <p className="p2 text-muted-foreground flex gap-2 items-center ">
          {getNClaims(subtopics)} claims by {getNPeople(subtopics)} people
        </p>
      </Row>
      {button}
    </Row>
  );
}

export function TopicContextDescription({
  context,
}: {
  context: string | undefined;
}) {
  return (
    <>
      <Col gap={2} className={`${context === undefined ? "hidden" : "p-8"}`}>
        <h5>More context</h5>
        <p>{context}</p>
      </Col>
      <Separator />
    </>
  );
}

/**
 * Both the claim-cells and the subtopic list. Together here since they interact with one another.
 * ! Can probably be refactored to be simpler.
 */
export function TopicInteractiveGraphic({
  children,
}: React.PropsWithChildren<{
  subtopics: SubtopicNode[];
}>) {
  const { dispatch } = useContext(ReportContext);
  const { topicNode } = useContext(TopicContext);
  const subtopics = topicNode.children.map((sub) => sub.data);
  const [topicsHoverState, onMouseOver, onMouseExit] = useGroupHover(subtopics);
  const buttonBackgroundColor = useThemeColor(topicNode.data.topicColor, "bg");

  return (
    <Col gap={3}>
      {/* Point graphic component */}
      <Row className="gap-x-[3px] gap-y-[3px] flex-wrap">
        {topicsHoverState.map(({ group: topic, isHovered }) => (
          <PointGraphicGroup
            key={topic.id}
            claims={topic.claims}
            isHighlighted={isHovered}
          />
        ))}
      </Row>

      {/* anything in between the point graphic and topic links */}
      {children}

      {/* Subtopic links */}
      <Row gap={3} className="space-between">
        <SubtopicList
          subtopics={topicsHoverState.map(({ group: topic }) => topic)}
          onMouseOver={onMouseOver}
          onMouseExit={onMouseExit}
        />
        <div className="self-center">
          <Button
            onClick={() =>
              dispatch({
                type: "toggleTopic",
                payload: { id: topicNode.data.id },
              })
            }
            className={buttonBackgroundColor}
          >
            {topicNode.isOpen ? "Collapse Topic" : "Expand Topic"}
          </Button>
        </div>
      </Row>
    </Col>
  );
}

/**
 * List of subtopics. When hovered should show a popup card and highlight the claim-cells.
 */
export function SubtopicList({
  onMouseOver,
  onMouseExit,
}: {
  subtopics: schema.Subtopic[];
  onMouseOver: (id: string) => void;
  onMouseExit: (id: string) => void;
}) {
  const { topicNode } = useContext(TopicContext);
  const subtopics = topicNode.children.map((sub) => sub.data);
  return (
    <TextIcon
      className="inline line-clamp-2 leading-6 flex-grow"
      icon={<Icons.Topic className="inline " />}
    >
      {subtopics.length} subtopics
      {"   "}
      {subtopics.map((subtopic, i) => (
        <SubtopicListItem
          key={subtopic.id}
          subtopic={subtopic}
          withComma={i !== subtopics.length - 1}
          onMouseOver={() => onMouseOver(subtopic.id)}
          onMouseOut={() => onMouseExit(subtopic.id)}
        />
      ))}
    </TextIcon>
  );
}

/**
 * Single item in a SubtopicList from above.
 */
export function SubtopicListItem({
  subtopic,
  withComma,
  onMouseOut,
  onMouseOver,
}: {
  subtopic: schema.Subtopic;
  withComma: boolean;
  onMouseOver: () => void;
  onMouseOut: () => void;
}) {
  const { dispatch } = useContext(ReportContext);
  const onClick = () =>
    dispatch({ type: "open", payload: { id: subtopic.id } });
  return (
    <HoverCard openDelay={300} closeDelay={0}>
      <HoverCardTrigger onClick={onClick}>
        <span
          className="cursor-pointer text-muted-foreground text-sm  inline"
          onMouseOver={onMouseOver}
          onMouseOut={onMouseOut}
        >
          <span className="link">{subtopic.title}</span>
          {withComma ? ",   " : ""}
        </span>
      </HoverCardTrigger>
      <HoverCardContent>
        <Col gap={4}>
          <SubtopicHeader
            title={subtopic.title}
            numClaims={subtopic.claims.length}
            numPeople={getNPeople(subtopic.claims)}
          />
          <p className="text-muted-foreground line-clamp-4">
            {subtopic.description}
          </p>
        </Col>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * When the TopicNode is expanded, show subtopics and handle pagination.
 */
function ExpandTopic() {
  const { topicNode } = useContext(TopicContext);
  const { isOpen, pagination, children: subtopicNodes, data } = topicNode;

  return (
    <>
      <Separator className={`${isOpen ? "" : "hidden"}`} />
      {isOpen && data.context ? (
        <TopicContextDescription context={data.context} />
      ) : (
        <></>
      )}
      {subtopicNodes.map((node, i) => (
        <Col key={node.data.id}>
          <Subtopic node={node} isOpen={isOpen && i <= pagination} />
        </Col>
      ))}
      {isOpen && pagination <= subtopicNodes.length && (
        <>
          <ShowMoreButton
            moreLeftNum={subtopicNodes.length - 1 - pagination}
            topicId={data.id}
            topicColor={data.topicColor}
          />
        </>
      )}
    </>
  );
}

function ShowMoreButton({
  moreLeftNum,
  topicId,
  topicColor,
}: {
  moreLeftNum: number;
  topicId: string;
  topicColor: string;
}) {
  const { dispatch } = useContext(ReportContext);
  const bg_color = useThemeColor(topicColor, "bgAccent");
  const text_color = useThemeColor(topicColor, "text");
  const border_color = useThemeColor(topicColor, "border");
  return moreLeftNum > 0 ? (
    <div className="p-4 sm:p-8">
      <Button
        variant={"secondary"}
        className={`${bg_color} ${text_color} ${border_color} border`}
        onClick={() =>
          dispatch({ type: "expandTopic", payload: { id: topicId } })
        }
      >
        {moreLeftNum} more subtopic{moreLeftNum > 1 ? "s" : ""}
      </Button>
    </div>
  ) : null;
}

export default Topic;
