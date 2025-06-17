import {
  ReportState,
  SubtopicNode,
  TopicNode,
} from "@/components/report/hooks/useReportState";
import { OutlineState, OutlineSubtopicNode, OutlineTopicNode } from "./types";
import { getThemeColor } from "@/lib/color";

//  ********************************
//  * State Builder *
//  *
//  * Functions for building the outline state
//  ********************************/

const outlineTreeBuilder = (nodes: TopicNode[]): OutlineTopicNode[] =>
  nodes.map((topic) => ({
    _tag: "OutlineTopicNode",
    id: topic.id,
    title: topic.data.title,
    isOpen: false,
    isHighlighted: false,
    color: getThemeColor(topic.data.topicColor, "text"),
    hoverColor: getThemeColor(topic.data.topicColor, "textHover"),
    children: topic.children.map((subtopic) =>
      outlineSubtopicNodeBuilder(subtopic, topic.data.topicColor),
    ),
  }));

const outlineSubtopicNodeBuilder = (
  subtopic: SubtopicNode,
  topicColor: string,
): OutlineSubtopicNode => ({
  _tag: "OutlineSubtopicNode",
  id: subtopic.id,
  title: subtopic.data.title,
  isHighlighted: false,
  color: getThemeColor(topicColor, "text"),
  hoverColor: getThemeColor(topicColor, "textHover"),
});

export const createInitialState = (reportState: ReportState): OutlineState => ({
  tree: outlineTreeBuilder(reportState.children),
  error: null,
  cache: {
    highlightedPath: null,
  },
});
