import * as schema from "tttc-common/schema";

//  ********************************
//  * TYPE DEFINITIONS
//  ********************************/

/**
 * All Node.data should have an id for easy lookup
 */
export type HasId = { id: string };

/**
 * A single Node in the NodeTree. Wraps data.
 */
export type Node<T extends HasId> = {
  data: Readonly<T>;
};

/**
 * Report State - highest level implementation
 */
export type ReportState = {
  children: ThemeNode[];
};

/**
 * Nodes with Themes as data
 */
export type ThemeNode = Node<schema.Theme> & {
  children: TopicNode[];
  isOpen: boolean;
  pagination: number;
};

/**
 * Nodes with Topic as data
 */
export type TopicNode = Node<schema.Topic> & {
  children: ClaimNode[];
  pagination: number;
};

export type ClaimNode = Node<schema.Claim>;

export type SomeNode = ThemeNode | TopicNode | ClaimNode;
