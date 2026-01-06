import type * as schema from "tttc-common/schema";
import {
  getNPeopleFromSubtopics,
  getNPeopleFromTopics,
} from "tttc-common/transforms";
import { defaultSubtopicPagination, defaultTopicPagination } from "./consts";
import type { ClaimNode, ReportState, SubtopicNode, TopicNode } from "./types";

//  ********************************
//  * STATE BUILDERS *
//  ********************************/

/**
 * Builds the report state from a list of topics
 */
export const stateBuilder = (topics: schema.Topic[]): ReportState => ({
  children: topics
    .map(makeTopicNode)
    .sort(
      (a, b) => getNPeopleFromTopics([b.data]) - getNPeopleFromTopics([a.data]),
    ),
  focusedId: null,
  error: null,
});

const makeTopicNode = (topic: schema.Topic): TopicNode => ({
  _tag: "TopicNode",
  id: topic.id,
  data: topic,
  isOpen: false,
  pagination: Math.min(topic.subtopics.length - 1, defaultTopicPagination),
  children: topic.subtopics
    .map(makeSubtopicNode)
    .sort(
      (a, b) =>
        getNPeopleFromSubtopics([b.data]) - getNPeopleFromSubtopics([a.data]),
    ),
});

const makeSubtopicNode = (subtopic: schema.Subtopic): SubtopicNode => ({
  _tag: "SubtopicNode",
  id: subtopic.id,
  data: subtopic,
  pagination: Math.min(subtopic.claims.length - 1, defaultSubtopicPagination),
  children: subtopic.claims.map(makeClaimNode),
});

const makeClaimNode = (claim: schema.Claim): ClaimNode => ({
  _tag: "ClaimNode",
  id: claim.id,
  data: claim,
});
