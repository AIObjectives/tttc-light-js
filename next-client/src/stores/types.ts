import type { Claim, Subtopic, Topic } from "tttc-common/schema";

// ============================================
// Node Types (preserving existing structure from useReportState)
// ============================================

/**
 * Claim node - leaf node in the report tree
 */
export interface ClaimNode {
  id: string;
  _tag: "ClaimNode";
  data: Claim;
}

/**
 * Subtopic node - contains claims
 */
export interface SubtopicNode {
  id: string;
  _tag: "SubtopicNode";
  data: Subtopic;
  children: ClaimNode[];
  /** Number of claims to display (0-indexed, so pagination=7 shows 8 claims) */
  pagination: number;
}

/**
 * Topic node - top-level node containing subtopics
 */
export interface TopicNode {
  id: string;
  _tag: "TopicNode";
  data: Topic;
  children: SubtopicNode[];
  isOpen: boolean;
  /** Number of subtopics to display (0-indexed) */
  pagination: number;
}

export type TreeNode = TopicNode | SubtopicNode | ClaimNode;

// ============================================
// Path Types for O(1) Lookups
// Mirrors the existing path.ts patterns
// ============================================

export interface TopicPath {
  type: "topic";
  topicIdx: number;
}

export interface SubtopicPath {
  type: "subtopic";
  topicIdx: number;
  subtopicIdx: number;
}

export interface ClaimPath {
  type: "claim";
  topicIdx: number;
  subtopicIdx: number;
  claimIdx: number;
}

export type TaggedPath = TopicPath | SubtopicPath | ClaimPath;

// ============================================
// Report Store Types
// ============================================

export interface ReportStoreState {
  /** Tree of topics containing subtopics and claims */
  topics: TopicNode[];
  /** O(1) lookup map: node id -> path to node */
  idMap: Record<string, TaggedPath>;
  /** Error message if something went wrong */
  error: string | null;
  /** Whether the store has been initialized with data */
  isInitialized: boolean;
}

export interface ReportStoreActions {
  // Initialization
  initialize: (topics: Topic[]) => void;
  reset: () => void;

  // Topic open/close actions
  openNode: (id: string) => void;
  closeNode: (id: string) => void;
  toggleTopic: (id: string) => void;
  openAllTopics: () => void;
  closeAllTopics: () => void;

  // Pagination
  expandPagination: (id: string) => void;

  // Error handling
  setError: (message: string) => void;
  clearError: () => void;

  // Node accessors (non-mutating)
  getNode: (id: string) => TreeNode | null;
  getTopicNode: (id: string) => TopicNode | null;
  getSubtopicNode: (id: string) => SubtopicNode | null;
}

export type ReportStore = ReportStoreState & ReportStoreActions;

// ============================================
// UI Store Types
// ============================================

export type SortMode = "frequent" | "controversy" | "bridging";
export type ContentTab = "report" | "cruxes";

export interface ReportUIStoreState {
  /** Current sort mode for topics/claims */
  sortMode: SortMode;
  /** Active content tab (report vs cruxes) */
  activeContentTab: ContentTab;
  /** ID of crux that should be auto-expanded */
  expandedCruxId: string | null;
  /** ID of currently focused node (for outline highlighting) */
  focusedNodeId: string | null;
  /** ID of currently focused crux */
  focusedCruxId: string | null;
  /** ID of element to scroll to */
  scrollToId: string | null;
  /** Scroll timestamp to force re-scroll to same ID */
  scrollToTimestamp: number;
  /** Whether mobile outline sheet is open */
  isMobileOutlineOpen: boolean;
}

export interface ReportUIStoreActions {
  // Sort
  setSortMode: (mode: SortMode) => void;

  // Navigation
  setActiveContentTab: (tab: ContentTab) => void;
  setExpandedCruxId: (id: string | null) => void;

  // Focus
  setFocusedNodeId: (id: string | null) => void;
  setFocusedCruxId: (id: string | null) => void;

  // Scroll
  scrollTo: (id: string) => void;
  clearScrollTo: () => void;

  // Mobile
  setMobileOutlineOpen: (open: boolean) => void;
  toggleMobileOutline: () => void;

  // Reset
  reset: () => void;
}

export type ReportUIStore = ReportUIStoreState & ReportUIStoreActions;
