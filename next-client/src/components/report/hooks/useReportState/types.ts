import * as schema from "tttc-common/schema";

//  ********************************
//  * NODE / STATE DEFINITIONS
//  ********************************/

/**
 * Report State - highest level implementation
 */
export type ReportState = {
  children: TopicNode[];
  focusedId: string | null;
  error: string | null;
};

/**
 * A single Node in the NodeTree. Wraps data.
 */
export type Node<T> = {
  id: string;
  data: Readonly<T>;
};

/**
 * Nodes with Topics as data
 */
export type TopicNode = Node<schema.Topic> & {
  readonly _tag: "TopicNode";
  children: SubtopicNode[];
  isOpen: boolean;
  pagination: number;
};

/**
 * Nodes with Subtopic as data
 */
export type SubtopicNode = Node<schema.Subtopic> & {
  readonly _tag: "SubtopicNode";
  children: ClaimNode[];
  pagination: number;
};

/**
 * Nodes with Claims as data
 */
export type ClaimNode = Node<schema.Claim> & {
  readonly _tag: "ClaimNode";
};

/**
 * Union of all nodes
 */
export type SomeNode = TopicNode | SubtopicNode | ClaimNode;
