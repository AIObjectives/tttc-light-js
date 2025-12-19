//  ********************************
//  * Types *
//  ********************************/

import type { TextClass, TextHoverClass } from "@/lib/color";

/**
 * Top level outline nodes for topics
 */
export type OutlineTopicNode = {
  _tag: "OutlineTopicNode";
  id: string;
  title: string;
  isOpen: boolean;
  isHighlighted: boolean;
  color: TextClass;
  hoverColor: TextHoverClass;
  children: OutlineSubtopicNode[];
};

/**
 * Child outline nodes for subtopics
 */
export type OutlineSubtopicNode = {
  _tag: "OutlineSubtopicNode";
  id: string;
  title: string;
  isHighlighted: boolean;
  color: TextClass;
  hoverColor: TextHoverClass;
};

/**
 * We cache the path of the current highlight node so we don't have to continously
 * set every node to isHighlighted:false everytime it changes.
 */
type OutlineCache = {
  highlightedPath: TaggedTopicPath | TaggedSubtopicPath | null;
};

export type OutlineState = {
  tree: OutlineTopicNode[];
  error: string | null;
  cache: OutlineCache;
};

export type TopicPath = {
  topicIdx: number;
};

export type TaggedTopicPath = TopicPath & { type: "topic" };

export type SubtopicPath = {
  topicIdx: number;
  subtopicIdx: number;
};

export type TaggedSubtopicPath = SubtopicPath & { type: "subtopic" };
