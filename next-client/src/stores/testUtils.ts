/**
 * Test utilities for building store state in stories and tests.
 * These functions mirror the internal store builders for creating
 * topic/subtopic/claim nodes without actually using the store.
 */
import type { Claim, Subtopic, Topic } from "tttc-common/schema";
import {
  getNPeopleFromSubtopics,
  getNPeopleFromTopics,
} from "tttc-common/transforms";
import type { Claim, Subtopic, Topic } from "tttc-common/schema";
import { defaultSubtopicPagination, defaultTopicPagination } from "./consts";
import type { ClaimNode, SubtopicNode, TopicNode } from "./types";

function makeClaimNode(claim: Claim): ClaimNode {
  return {
    _tag: "ClaimNode",
    id: claim.id,
    data: claim,
  };
}

function makeSubtopicNode(subtopic: Subtopic): SubtopicNode {
  return {
    _tag: "SubtopicNode",
    id: subtopic.id,
    data: subtopic,
    pagination: Math.min(subtopic.claims.length - 1, defaultSubtopicPagination),
    children: subtopic.claims.map(makeClaimNode),
  };
}

function makeTopicNode(topic: Topic): TopicNode {
  const subtopicNodes = topic.subtopics
    .map(makeSubtopicNode)
    .sort(
      (a, b) =>
        getNPeopleFromSubtopics([b.data]) - getNPeopleFromSubtopics([a.data]),
    );

  return {
    _tag: "TopicNode",
    id: topic.id,
    data: topic,
    isOpen: false,
    pagination: Math.min(topic.subtopics.length - 1, defaultTopicPagination),
    children: subtopicNodes,
  };
}

/**
 * Builds an array of TopicNodes from raw topics.
 * Useful for stories that need topic nodes without the full store.
 */
export function buildTopicNodes(topics: Topic[]): TopicNode[] {
  return topics
    .map(makeTopicNode)
    .sort(
      (a, b) => getNPeopleFromTopics([b.data]) - getNPeopleFromTopics([a.data]),
    );
}

/**
 * Builds a single TopicNode from a raw topic.
 */
export function buildTopicNode(topic: Topic): TopicNode {
  return makeTopicNode(topic);
}

/**
 * Builds a single SubtopicNode from a raw subtopic.
 */
export function buildSubtopicNode(subtopic: Subtopic): SubtopicNode {
  return makeSubtopicNode(subtopic);
}
