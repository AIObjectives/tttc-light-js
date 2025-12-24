import { reportData } from "__tests__/data/testData";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useReportStore } from "../reportStore";

describe("reportStore", () => {
  // Reset store between tests
  beforeEach(() => {
    useReportStore.getState().reset();
  });

  afterEach(() => {
    useReportStore.getState().reset();
  });

  describe("initialization", () => {
    it("should initialize with topics and build idMap", () => {
      const { initialize } = useReportStore.getState();

      initialize(reportData.topics);

      const state = useReportStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.topics.length).toBeGreaterThan(0);
      expect(Object.keys(state.idMap).length).toBeGreaterThan(0);
      expect(state.error).toBeNull();
    });

    it("should build correct path types in idMap", () => {
      const { initialize } = useReportStore.getState();

      initialize(reportData.topics);

      const { topics, idMap } = useReportStore.getState();

      // Check topic path
      const firstTopic = topics[0];
      const topicPath = idMap[firstTopic.id];
      expect(topicPath).toEqual({ type: "topic", topicIdx: 0 });

      // Check subtopic path
      const firstSubtopic = firstTopic.children[0];
      if (firstSubtopic) {
        const subtopicPath = idMap[firstSubtopic.id];
        expect(subtopicPath).toEqual({
          type: "subtopic",
          topicIdx: 0,
          subtopicIdx: 0,
        });
      }

      // Check claim path
      const firstClaim = firstTopic.children[0]?.children[0];
      if (firstClaim) {
        const claimPath = idMap[firstClaim.id];
        expect(claimPath).toEqual({
          type: "claim",
          topicIdx: 0,
          subtopicIdx: 0,
          claimIdx: 0,
        });
      }
    });

    it("should reset to initial state", () => {
      const { initialize, reset } = useReportStore.getState();

      initialize(reportData.topics);
      expect(useReportStore.getState().isInitialized).toBe(true);

      reset();

      const state = useReportStore.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.topics).toHaveLength(0);
      expect(Object.keys(state.idMap)).toHaveLength(0);
    });
  });

  describe("open/close actions", () => {
    beforeEach(() => {
      useReportStore.getState().initialize(reportData.topics);
    });

    it("should open a topic", () => {
      const { openNode, topics } = useReportStore.getState();
      const topicId = topics[0].id;

      expect(useReportStore.getState().topics[0].isOpen).toBe(false);

      openNode(topicId);

      expect(useReportStore.getState().topics[0].isOpen).toBe(true);
    });

    it("should close a topic", () => {
      const { openNode, closeNode, topics } = useReportStore.getState();
      const topicId = topics[0].id;

      openNode(topicId);
      expect(useReportStore.getState().topics[0].isOpen).toBe(true);

      closeNode(topicId);
      expect(useReportStore.getState().topics[0].isOpen).toBe(false);
    });

    it("should toggle a topic", () => {
      const { toggleTopic, topics } = useReportStore.getState();
      const topicId = topics[0].id;

      expect(useReportStore.getState().topics[0].isOpen).toBe(false);

      toggleTopic(topicId);
      expect(useReportStore.getState().topics[0].isOpen).toBe(true);

      toggleTopic(topicId);
      expect(useReportStore.getState().topics[0].isOpen).toBe(false);
    });

    it("should open parent topic when opening a subtopic", () => {
      const { openNode, topics } = useReportStore.getState();
      const subtopicId = topics[0].children[0]?.id;

      if (subtopicId) {
        expect(useReportStore.getState().topics[0].isOpen).toBe(false);

        openNode(subtopicId);

        expect(useReportStore.getState().topics[0].isOpen).toBe(true);
      }
    });

    it("should open all topics", () => {
      const { openAllTopics } = useReportStore.getState();

      openAllTopics();

      const { topics } = useReportStore.getState();
      expect(topics.every((t) => t.isOpen)).toBe(true);
    });

    it("should close all topics", () => {
      const { openAllTopics, closeAllTopics } = useReportStore.getState();

      openAllTopics();
      expect(useReportStore.getState().topics.every((t) => t.isOpen)).toBe(
        true,
      );

      closeAllTopics();
      expect(useReportStore.getState().topics.every((t) => !t.isOpen)).toBe(
        true,
      );
    });

    it("should set error for non-existent node id", () => {
      const { openNode } = useReportStore.getState();

      openNode("non-existent-id");

      expect(useReportStore.getState().error).toContain("non-existent-id");
    });
  });

  describe("pagination", () => {
    beforeEach(() => {
      useReportStore.getState().initialize(reportData.topics);
    });

    it("should expand topic pagination", () => {
      const { expandPagination, topics } = useReportStore.getState();
      const topicId = topics[0].id;
      const initialPagination = topics[0].pagination;

      expandPagination(topicId);

      const newPagination = useReportStore.getState().topics[0].pagination;
      expect(newPagination).toBeGreaterThan(initialPagination);
    });

    it("should expand subtopic pagination", () => {
      const { expandPagination, topics } = useReportStore.getState();
      const subtopic = topics[0].children[0];

      if (subtopic) {
        const initialPagination = subtopic.pagination;

        expandPagination(subtopic.id);

        const newPagination =
          useReportStore.getState().topics[0].children[0].pagination;
        expect(newPagination).toBeGreaterThan(initialPagination);
      }
    });

    it("should not exceed max pagination", () => {
      const { expandPagination, topics } = useReportStore.getState();
      const topicId = topics[0].id;
      const maxPagination = topics[0].children.length - 1;

      // Expand many times
      for (let i = 0; i < 100; i++) {
        expandPagination(topicId);
      }

      const finalPagination = useReportStore.getState().topics[0].pagination;
      expect(finalPagination).toBeLessThanOrEqual(maxPagination);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      useReportStore.getState().initialize(reportData.topics);
    });

    it("should set error message", () => {
      const { setError } = useReportStore.getState();

      setError("Test error message");

      expect(useReportStore.getState().error).toBe("Test error message");
    });

    it("should clear error message", () => {
      const { setError, clearError } = useReportStore.getState();

      setError("Test error");
      expect(useReportStore.getState().error).toBe("Test error");

      clearError();
      expect(useReportStore.getState().error).toBeNull();
    });
  });

  describe("node accessors", () => {
    beforeEach(() => {
      useReportStore.getState().initialize(reportData.topics);
    });

    it("should get topic node by id", () => {
      const { getTopicNode, topics } = useReportStore.getState();
      const topicId = topics[0].id;

      const topic = getTopicNode(topicId);

      expect(topic).not.toBeNull();
      expect(topic?._tag).toBe("TopicNode");
      expect(topic?.id).toBe(topicId);
    });

    it("should get subtopic node by id", () => {
      const { getSubtopicNode, topics } = useReportStore.getState();
      const subtopic = topics[0].children[0];

      if (subtopic) {
        const result = getSubtopicNode(subtopic.id);

        expect(result).not.toBeNull();
        expect(result?._tag).toBe("SubtopicNode");
        expect(result?.id).toBe(subtopic.id);
      }
    });

    it("should get any node by id", () => {
      const { getNode, topics } = useReportStore.getState();

      // Topic
      const topic = getNode(topics[0].id);
      expect(topic?._tag).toBe("TopicNode");

      // Subtopic
      const subtopic = topics[0].children[0];
      if (subtopic) {
        const subtopicNode = getNode(subtopic.id);
        expect(subtopicNode?._tag).toBe("SubtopicNode");
      }

      // Claim
      const claim = topics[0].children[0]?.children[0];
      if (claim) {
        const claimNode = getNode(claim.id);
        expect(claimNode?._tag).toBe("ClaimNode");
      }
    });

    it("should return null for non-existent id", () => {
      const { getNode, getTopicNode, getSubtopicNode } =
        useReportStore.getState();

      expect(getNode("non-existent")).toBeNull();
      expect(getTopicNode("non-existent")).toBeNull();
      expect(getSubtopicNode("non-existent")).toBeNull();
    });

    it("should return null when getting wrong node type", () => {
      const { getTopicNode, getSubtopicNode, topics } =
        useReportStore.getState();
      const subtopic = topics[0].children[0];

      if (subtopic) {
        // Try to get subtopic as topic
        expect(getTopicNode(subtopic.id)).toBeNull();

        // Try to get topic as subtopic
        expect(getSubtopicNode(topics[0].id)).toBeNull();
      }
    });
  });

  describe("tree structure", () => {
    it("should create topics from input data", () => {
      useReportStore.getState().initialize(reportData.topics);

      const { topics } = useReportStore.getState();

      // Verify topics were created
      expect(topics.length).toBeGreaterThan(0);
      // Topics should match input count
      expect(topics.length).toBe(reportData.topics.length);
    });

    it("should create correct node structure", () => {
      useReportStore.getState().initialize(reportData.topics);

      const { topics } = useReportStore.getState();

      // Check TopicNode structure
      expect(topics[0]._tag).toBe("TopicNode");
      expect(topics[0]).toHaveProperty("isOpen");
      expect(topics[0]).toHaveProperty("pagination");
      expect(topics[0]).toHaveProperty("children");

      // Check SubtopicNode structure
      const subtopic = topics[0].children[0];
      if (subtopic) {
        expect(subtopic._tag).toBe("SubtopicNode");
        expect(subtopic).toHaveProperty("pagination");
        expect(subtopic).toHaveProperty("children");
      }

      // Check ClaimNode structure
      const claim = topics[0].children[0]?.children[0];
      if (claim) {
        expect(claim._tag).toBe("ClaimNode");
        expect(claim).toHaveProperty("data");
      }
    });
  });
});
