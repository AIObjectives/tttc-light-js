import { getNPeople } from "tttc-common/morphisms";
import type { Claim, Subtopic, Topic } from "tttc-common/schema";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { DEVTOOLS_ENABLED } from "./middleware";
import type {
  ClaimNode,
  ReportStore,
  SubtopicNode,
  TaggedPath,
  TopicNode,
  TreeNode,
} from "./types";

// ============================================
// Constants (matching existing useReportState behavior)
// ============================================

/** Initial subtopics shown per topic (0-indexed, so 1 = show 2) */
const DEFAULT_TOPIC_PAGINATION = 1;
/** Additional subtopics shown on expand */
const TOPIC_PAGINATION_INCREMENT = 2;

/** Initial claims shown per subtopic (0-indexed, so 7 = show 8) */
const DEFAULT_SUBTOPIC_PAGINATION = 7;
/** Additional claims shown on expand */
const SUBTOPIC_PAGINATION_INCREMENT = 9;

// ============================================
// Tree Building Helpers
// Replaces FP patterns with straightforward iteration
// ============================================

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
    pagination: Math.min(
      subtopic.claims.length - 1,
      DEFAULT_SUBTOPIC_PAGINATION,
    ),
    children: subtopic.claims.map(makeClaimNode),
  };
}

function makeTopicNode(topic: Topic): TopicNode {
  const subtopicNodes = topic.subtopics
    .map(makeSubtopicNode)
    // Sort subtopics by number of people (most first)
    .sort((a, b) => getNPeople([b.data]) - getNPeople([a.data]));

  return {
    _tag: "TopicNode",
    id: topic.id,
    data: topic,
    isOpen: false,
    pagination: Math.min(topic.subtopics.length - 1, DEFAULT_TOPIC_PAGINATION),
    children: subtopicNodes,
  };
}

/**
 * Builds the tree structure and idMap from raw topics.
 * This replaces the effect library's pipe/flow patterns.
 */
function buildTree(topics: Topic[]): {
  nodes: TopicNode[];
  idMap: Record<string, TaggedPath>;
} {
  const idMap: Record<string, TaggedPath> = {};

  // Build topic nodes and sort by number of people (most first)
  const nodes: TopicNode[] = topics
    .map(makeTopicNode)
    .sort((a, b) => getNPeople([b.data]) - getNPeople([a.data]));

  // Build the idMap for O(1) lookups
  nodes.forEach((topic, topicIdx) => {
    idMap[topic.id] = { type: "topic", topicIdx };

    topic.children.forEach((subtopic, subtopicIdx) => {
      idMap[subtopic.id] = { type: "subtopic", topicIdx, subtopicIdx };

      subtopic.children.forEach((claim, claimIdx) => {
        idMap[claim.id] = { type: "claim", topicIdx, subtopicIdx, claimIdx };
      });
    });
  });

  return { nodes, idMap };
}

// ============================================
// Initial State
// ============================================

const initialState: Pick<
  ReportStore,
  "topics" | "idMap" | "error" | "isInitialized"
> = {
  topics: [],
  idMap: {},
  error: null,
  isInitialized: false,
};

// ============================================
// Store Definition
// ============================================

export const useReportStore = create<ReportStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ----------------------------------------
      // Initialization
      // ----------------------------------------

      initialize: (topics: Topic[]) => {
        const { nodes, idMap } = buildTree(topics);
        set((state) => {
          state.topics = nodes;
          state.idMap = idMap;
          state.isInitialized = true;
          state.error = null;
        });
      },

      reset: () => {
        set((state) => {
          state.topics = [];
          state.idMap = {};
          state.error = null;
          state.isInitialized = false;
        });
      },

      // ----------------------------------------
      // Open/Close Actions
      // ----------------------------------------

      openNode: (id: string) => {
        const path = get().idMap[id];
        if (!path) {
          set((state) => {
            state.error = `Could not find node with id: ${id}`;
          });
          return;
        }

        // Only topics can be opened/closed
        if (path.type === "topic") {
          set((state) => {
            state.topics[path.topicIdx].isOpen = true;
          });
        }
        // Opening a subtopic or claim opens the parent topic
        else if (path.type === "subtopic" || path.type === "claim") {
          set((state) => {
            state.topics[path.topicIdx].isOpen = true;
          });
        }
      },

      closeNode: (id: string) => {
        const path = get().idMap[id];
        if (!path || path.type !== "topic") return;

        set((state) => {
          state.topics[path.topicIdx].isOpen = false;
        });
      },

      toggleTopic: (id: string) => {
        const path = get().idMap[id];
        if (!path || path.type !== "topic") return;

        set((state) => {
          const topic = state.topics[path.topicIdx];
          topic.isOpen = !topic.isOpen;
        });
      },

      openAllTopics: () => {
        set((state) => {
          for (const topic of state.topics) {
            topic.isOpen = true;
          }
        });
      },

      closeAllTopics: () => {
        set((state) => {
          for (const topic of state.topics) {
            topic.isOpen = false;
          }
        });
      },

      // ----------------------------------------
      // Pagination Actions
      // ----------------------------------------

      expandPagination: (id: string) => {
        const path = get().idMap[id];
        if (!path) return;

        if (path.type === "topic") {
          set((state) => {
            const topic = state.topics[path.topicIdx];
            topic.pagination = Math.min(
              topic.pagination + TOPIC_PAGINATION_INCREMENT,
              topic.children.length - 1,
            );
          });
        } else if (path.type === "subtopic") {
          set((state) => {
            const subtopic =
              state.topics[path.topicIdx].children[path.subtopicIdx];
            subtopic.pagination = Math.min(
              subtopic.pagination + SUBTOPIC_PAGINATION_INCREMENT,
              subtopic.children.length - 1,
            );
          });
        }
      },

      // ----------------------------------------
      // Error Handling
      // ----------------------------------------

      setError: (message: string) => {
        set((state) => {
          state.error = message;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      // ----------------------------------------
      // Node Accessors (non-mutating, use get())
      // ----------------------------------------

      getNode: (id: string): TreeNode | null => {
        const { idMap, topics } = get();
        const path = idMap[id];
        if (!path) return null;

        switch (path.type) {
          case "topic":
            return topics[path.topicIdx] ?? null;
          case "subtopic":
            return topics[path.topicIdx]?.children[path.subtopicIdx] ?? null;
          case "claim":
            return (
              topics[path.topicIdx]?.children[path.subtopicIdx]?.children[
                path.claimIdx
              ] ?? null
            );
        }
      },

      getTopicNode: (id: string): TopicNode | null => {
        const node = get().getNode(id);
        return node?._tag === "TopicNode" ? node : null;
      },

      getSubtopicNode: (id: string): SubtopicNode | null => {
        const node = get().getNode(id);
        return node?._tag === "SubtopicNode" ? node : null;
      },
    })),
    { name: "reportStore", enabled: DEVTOOLS_ENABLED },
  ),
);

// ============================================
// Selector Hooks for Optimized Subscriptions
// These provide fine-grained reactivity - components
// only re-render when their specific data changes.
// ============================================

/**
 * Select a single topic by ID with O(1) lookup.
 * Only re-renders when this specific topic changes.
 */
export function useTopicNode(id: string): TopicNode | null {
  return useReportStore((state) => {
    const path = state.idMap[id];
    if (!path || path.type !== "topic") return null;
    return state.topics[path.topicIdx] ?? null;
  });
}

/**
 * Select whether a topic is open.
 * Minimal subscription - only re-renders on isOpen change.
 */
export function useTopicIsOpen(id: string): boolean {
  return useReportStore((state) => {
    const path = state.idMap[id];
    if (!path || path.type !== "topic") return false;
    return state.topics[path.topicIdx]?.isOpen ?? false;
  });
}

/**
 * Select all topics (for iteration).
 */
export function useTopics(): TopicNode[] {
  return useReportStore((state) => state.topics);
}

/**
 * Select all topic IDs for lightweight iteration.
 */
export function useTopicIds(): string[] {
  return useReportStore((state) => state.topics.map((t) => t.id));
}

/**
 * Check if store is initialized.
 */
export function useReportStoreInitialized(): boolean {
  return useReportStore((state) => state.isInitialized);
}

/**
 * Select the current error message.
 */
export function useReportError(): string | null {
  return useReportStore((state) => state.error);
}
