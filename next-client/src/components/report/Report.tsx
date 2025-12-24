"use client";

import { ChevronsUpDown } from "lucide-react";
import React, {
  createContext,
  type Dispatch,
  type Ref,
  type SetStateAction,
  useContext,
  useEffect,
  useRef,
} from "react";
import { toast } from "sonner";
// Default prompts for comparison
import {
  defaultClusteringPrompt,
  defaultCruxPrompt,
  defaultDedupPrompt,
  defaultExtractionPrompt,
  defaultSummariesPrompt,
  defaultSystemPrompt,
} from "tttc-common/prompts";
import type * as schema from "tttc-common/schema";
import { getSortedCruxes, getTopicControversy } from "@/lib/crux/utils";
import { useHashChange } from "@/lib/hooks/useHashChange";
import { downloadReportData } from "@/lib/report/downloadUtils";
import { cn } from "@/lib/utils/shadcn";
// Zustand stores for state management
import { useReportStore } from "@/stores/reportStore";
import {
  useActiveContentTab,
  useExpandedCruxId,
  useFocusedCruxId,
  useIsMobileOutlineOpen,
  useReportUIStore,
  useSortByBridging,
  useSortByControversy,
  useSortMode,
} from "@/stores/reportUIStore";
import type { SortMode } from "@/stores/types";
import {
  Button,
  CardContent,
  ErrorBoundary,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../elements";
import { Col, Row } from "../layout";
import Outline from "../outline/Outline";
import Theme from "../topic/Topic";
import { CruxCard } from "./CruxCard";
import { ProcessingSummary } from "./components/ProcessingSummary";
import { PromptToggle } from "./components/PromptToggle";
import { ReportHeader } from "./components/ReportHeader";
// Extracted components
import { ReportLayout } from "./components/ReportLayout";
import { ReportToolbar } from "./components/ReportToolbar";
import { SortDropdown } from "./components/SortDropdown";
import { useNavbarVisibility } from "./hooks/useNavbarVisibility";
import { useTabHashSync } from "./hooks/useTabHashSync";

/**
 * Report Component
 *
 * This is the highest level component for /report/
 * Uses Zustand stores for state management (reportStore and reportUIStore).
 */

/**
 * Content tab type
 */
type ContentTab = "report" | "cruxes";

// Re-export SortMode from stores for backward compatibility
export type { SortMode } from "@/stores/types";

/**
 * Content tab type
 */
type ContentTab = "report" | "cruxes";

/**
 * Context thats passed through Report
 */
export const ReportContext = createContext<{
  // Dispatch for ReportState is passed so components can trigger state change
  dispatch: Dispatch<ReportStateAction>;
  // Used to setup scroll-to behaviors by passing a ref
  useScrollTo: (listenForId: string) => Ref<HTMLDivElement>;
  // Sets the page to scroll to an element based on its id
  setScrollTo: Dispatch<SetStateAction<[string, number]>>;
  // Allows side-effects from changes to ReportState
  useReportEffect: ReportActionEffect;
  // Tracks which node is being "focused"
  useFocusedNode: (id: string, ignore?: boolean) => Ref<HTMLDivElement>;
  // Tracks which crux is being "focused" (separate from node tracking)
  useFocusedNodeForCruxes: (
    id: string,
    ignore?: boolean,
  ) => Ref<HTMLDivElement>;
  // Temporarily suppress scroll-based focus tracking (for programmatic navigation)
  suppressFocusTracking: (durationMs?: number) => void;
  // Add-ons data from pipeline (including cruxes and controversy scores)
  addOns?: schema.AddOns;
  // Unified sort mode (frequent, controversy, or bridging)
  sortMode: SortMode;
  // NOTE: Store action signature - accepts value directly (not SetStateAction)
  setSortMode: (mode: SortMode) => void;
  // Derived booleans for backward compatibility with sorting logic
  sortByControversy: boolean;
  sortByBridging: boolean;
  // ID of crux that should be auto-expanded (e.g., when navigating from Cruxes tab)
  expandedCruxId: string | null;
  // NOTE: Store action signature - accepts value directly (not SetStateAction)
  setExpandedCruxId: (id: string | null) => void;
  // Active content tab ("report" or "cruxes")
  activeContentTab: ContentTab;
  // NOTE: Store action signature - accepts value directly (not SetStateAction)
  setActiveContentTab: (tab: ContentTab) => void;
  // Get topic color by topic title
  getTopicColor: (topicTitle: string) => string | undefined;
  getSubtopicId: (topicTitle: string, subtopicTitle: string) => string | null;
}>({
  addOns: undefined,
  sortMode: "frequent",
  setSortMode: () => {},
  sortByControversy: false,
  sortByBridging: false,
  expandedCruxId: null,
  setExpandedCruxId: () => {},
  activeContentTab: "report",
  setActiveContentTab: () => {},
  getTopicColor: () => undefined,
  getSubtopicId: () => null,
});

/**
 * Report feature
 */
function Report({
  reportData,
  reportUri: _reportUri,
  rawPipelineOutput,
}: {
  reportData: schema.UIReportData;
  reportUri: string;
  rawPipelineOutput: schema.PipelineOutput;
}) {
  // ========================================
  // Zustand Store Initialization
  // ========================================

  // Get store actions
  const initializeStore = useReportStore((s) => s.initialize);
  const resetStore = useReportStore((s) => s.reset);

  // UI store actions
  const resetUIStore = useReportUIStore((s) => s.reset);
  const setFocusedCruxIdStore = useReportUIStore((s) => s.setFocusedCruxId);

  // UI store state (using selector hooks for optimized subscriptions)
  const sortMode = useSortMode();
  const setSortMode = useReportUIStore((s) => s.setSortMode);
  const sortByControversy = useSortByControversy();
  const sortByBridging = useSortByBridging();
  const activeContentTab = useActiveContentTab();
  const setActiveContentTab = useReportUIStore((s) => s.setActiveContentTab);
  const expandedCruxId = useExpandedCruxId();
  const setExpandedCruxId = useReportUIStore((s) => s.setExpandedCruxId);
  const focusedCruxId = useFocusedCruxId();
  const isMobileOutlineOpen = useIsMobileOutlineOpen();
  const setMobileOutlineOpen = useReportUIStore((s) => s.setMobileOutlineOpen);

  // Initialize stores on mount, cleanup on unmount
  useEffect(() => {
    initializeStore(reportData.topics);
    return () => {
      resetStore();
      resetUIStore();
    };
  }, [reportData.topics, initializeStore, resetStore, resetUIStore]);

  // ========================================
  // Legacy Hooks (kept for backward compatibility)
  // Will be replaced as components are migrated
  // ========================================

  // Report State reducer (legacy - still needed for passing TopicNode to components)
  const [state, _dispatch] = useReportState(reportData.topics);
  // url hash
  const hashNav = useHashChange();
  // Sets up useReportEffect, which can trigger side-effects when Report State dispatch is called.
  const [dispatch, useReportEffect] = useReportSubscribe(_dispatch);
  // Hook that sets up scrolling behavior.
  const [useScrollTo, setScrollTo] = useScrollListener(useReportEffect);
  // Allows us to keep track of what node is in the middle of the screen. Needs to pass hook to nodes.
  // Also returns a suppress function to temporarily disable scroll-based tracking during programmatic navigation.
  const [useFocusedNode, suppressFocusTracking] = _useFocusedNode(
    (id: string) => dispatch({ type: "focus", payload: { id } }),
  );
  // Track focused crux for outline highlighting (bridged to store)
  const [useFocusedNodeForCruxes] = _useFocusedNode((id: string) =>
    setFocusedCruxIdStore(id),
  );
  // Track navbar visibility for sheet positioning
  const navbarState = useNavbarVisibility();

  // Get topics from Zustand store (source of truth for UI state)
  const storeTopics = useTopics();

  // Hash navigation - open the matching node when URL hash changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: openNode is stable, storeTopics is read inside effect but shouldn't trigger re-runs
  useEffect(() => {
    if (!hashNav || storeTopics.length === 0) return;
    const nodes = [
      ...storeTopics.map((topic) => topic),
      ...storeTopics.flatMap((topic) => topic.children.map((sub) => sub)),
      ...storeTopics.flatMap((topic) =>
        topic.children.flatMap((sub) => sub.children.map((clm) => clm)),
      ),
    ];
    const matchingNode = nodes.find((node) => node.data.title === hashNav);
    if (!matchingNode) return;
    openNode(matchingNode.data.id);
  }, [hashNav]);

  const [outlineState, outlineDispatch] = useOutlineState(state);

  // When Report State dispatch is called, outline state should dispatch some action
  useReportEffect((action) => {
    const matchAction = (
      action: ReportStateAction,
    ): OutlineStateAction | null => {
      switch (action.type) {
        case "open":
        case "close": {
          return {
            type: action.type,
            payload: action.payload,
          };
        }
        case "toggleTopic": {
          return {
            type: "toggle",
            payload: action.payload,
          };
        }
        case "closeAll":
        case "openAll": {
          return {
            type: action.type,
          };
        }
        case "focus": {
          return {
            type: "highlight",
            payload: action.payload,
          };
        }
        default: {
          return null;
        }
      }
    };
    const outlineAction = matchAction(action);
    if (!outlineAction) return;
    outlineDispatch(outlineAction);
  });

  // Extract addOns to avoid rawPipelineOutput object reference changes breaking memoization
  const addOns = React.useMemo(
    () => rawPipelineOutput.data[1]?.addOns,
    [rawPipelineOutput.data],
  );

  // Sort topics if sortByControversy is enabled
  const sortedTopics = React.useMemo(() => {
    if (!sortByControversy) {
      return storeTopics;
    }

    return [...storeTopics].sort((a, b) => {
      const scoreA = getTopicControversy(addOns, a.data?.title) ?? -1;
      const scoreB = getTopicControversy(addOns, b.data?.title) ?? -1;
      // Sort descending (highest controversy first)
      return scoreB - scoreA;
    });
  }, [sortByControversy, storeTopics, addOns]);

  // Build topic color map for AgreeDisagreeSpectrum
  const topicColorMap = React.useMemo(() => {
    const colorMap = new Map<string, string>();
    storeTopics.forEach((topic) => {
      if (topic.data?.topicColor) {
        colorMap.set(topic.data.title, topic.data.topicColor);
      }
    });
    return colorMap;
  }, [storeTopics]);

  const getTopicColor = React.useCallback(
    (topicTitle: string): string | undefined => {
      return topicColorMap.get(topicTitle);
    },
    [topicColorMap],
  );

  // Build subtopic ID map for navigation from cruxes outline
  const subtopicIdMap = React.useMemo(() => {
    const idMap = new Map<string, string>();
    const subtopicOnly = new Map<string, string>();
    storeTopics.forEach((topic) => {
      topic.data.subtopics.forEach((subtopic) => {
        idMap.set(`${topic.data.title}::${subtopic.title}`, subtopic.id);
        subtopicOnly.set(subtopic.title, subtopic.id);
      });
    });
    return { idMap, subtopicOnly };
  }, [storeTopics]);

  const getSubtopicId = React.useCallback(
    (topicTitle: string, subtopicTitle: string): string | null => {
      const exactMatch = subtopicIdMap.idMap.get(
        `${topicTitle}::${subtopicTitle}`,
      );
      if (exactMatch) return exactMatch;
      return subtopicIdMap.subtopicOnly.get(subtopicTitle) ?? null;
    },
    [subtopicIdMap],
  );

  return (
    <ReportDataContext.Provider
      value={{
        addOns,
        getTopicColor,
        getSubtopicId,
      }}
    >
      {/* Wrapper div is here to just give some space at the bottom of the screen */}
      <div className="mb-36">
        <ReportLayout
          isMobileOutlineOpen={isMobileOutlineOpen}
          setIsMobileOutlineOpen={setMobileOutlineOpen}
          navbarState={navbarState}
          activeContentTab={activeContentTab}
          Report={
            <Col gap={4} className="px-3">
              <ReportHeader
                topics={reportData.topics}
                date={reportData.date}
                title={reportData.title}
                description={reportData.description}
                questionAnswers={reportData.questionAnswers}
              />
              <ReportContentTabs
                sortedTopics={sortedTopics}
                topics={reportData.topics}
                addOns={addOns}
                rawPipelineOutput={rawPipelineOutput}
                filename={reportData.title}
              />
            </Col>
          }
          ToolBar={
            <ReportToolbar
              setIsMobileOutlineOpen={setMobileOutlineOpen}
              isMobileOutlineOpen={isMobileOutlineOpen}
            />
          }
          Outline={
            <Outline
              outlineState={outlineState}
              outlineDispatch={outlineDispatch}
              reportDispatch={dispatch}
              onNavigate={() => setMobileOutlineOpen(false)}
            />
          }
        />
      </div>
    </ReportDataContext.Provider>
  );
}

/**
 * Tabbed content section below the overview.
 * Shows "Report" (topics/claims) or "Cruxes" tabs with sort dropdown.
 */
function ReportContentTabs({
  sortedTopics,
  topics,
  addOns,
  rawPipelineOutput,
  filename,
}: {
  sortedTopics: TopicNode[];
  topics: schema.Topic[];
  addOns?: schema.AddOns;
  rawPipelineOutput: schema.PipelineOutput;
  filename: string;
}) {
  const openNode = useReportStore((s) => s.openNode);
  const activeContentTab = useActiveContentTab();
  const setActiveContentTab = useReportUIStore((s) => s.setActiveContentTab);

  // Check if we have controversy data
  const hasControversyData =
    addOns?.subtopicCruxes && addOns.subtopicCruxes.length > 0;

  // Check if we have bridging data
  const hasBridgingData =
    addOns?.claimBridgingScores && addOns.claimBridgingScores.length > 0;

  const handleNavigateToSubtopic = (subtopicId: string) => {
    // Switch to report tab
    setActiveContentTab("report");

    // Expand the topic and subtopic
    openNode(subtopicId);
  };

  // Sync URL hash with tab state
  useTabHashSync(activeContentTab, setActiveContentTab, !!hasControversyData);

  const showSortDropdown =
    activeContentTab === "report" && (hasControversyData || hasBridgingData);

  return (
    <CardContent className="px-0 -mt-6">
      <Tabs
        value={activeContentTab}
        onValueChange={(value) => setActiveContentTab(value as ContentTab)}
      >
        {/* Tabs row with sort dropdown */}
        <Row className="justify-between items-center mb-4">
          {/* Only show tab toggle if there are cruxes to switch between */}
          {hasControversyData && (
            <TabsList>
              <TabsTrigger value="report">Report</TabsTrigger>
              <TabsTrigger value="cruxes">Cruxes</TabsTrigger>
            </TabsList>
          )}

          {/* Sort dropdown - show when on Report tab and at least one sort feature is available */}
          {showSortDropdown && (
            <SortDropdown
              hasControversyData={!!hasControversyData}
              hasBridgingData={!!hasBridgingData}
            />
          )}
        </Row>

        {/* Tab content */}
        <TabsContent value="report" className="mt-0">
          <Col gap={4}>
            {sortedTopics.map((themeNode) => (
              <Theme key={themeNode.data.id} node={themeNode} />
            ))}
          </Col>
        </TabsContent>
        <TabsContent value="cruxes" className="mt-0">
          <ErrorBoundary
            fallback={(reset) => (
              <Col gap={4} className="p-8">
                <div>
                  <h3 className="text-lg font-semibold">
                    Unable to display controversy data
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    There was a problem loading the controversy visualization.
                  </p>
                </div>
                <div>
                  <Button onClick={reset} variant="outline" size="sm">
                    Try Again
                  </Button>
                </div>
              </Col>
            )}
          >
            <CruxesOverview
              addOns={addOns}
              topics={topics}
              onNavigateToSubtopic={handleNavigateToSubtopic}
            />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Appendix shown on all tabs */}
      <Appendix filename={filename} rawPipelineOutput={rawPipelineOutput} />
    </CardContent>
  );
}

/**
 * Displays a list of all cruxes (controversial points) in the report,
 * sorted by controversy score (highest first).
 */
export function CruxesOverview({
  addOns,
  topics,
  onNavigateToSubtopic,
}: {
  addOns?: schema.AddOns;
  topics: schema.Topic[];
  onNavigateToSubtopic?: (subtopicId: string) => void;
}) {
  const sortedCruxes = getSortedCruxes(addOns);

  // Build lookup maps once to avoid O(N×M×P) nested loops in render
  const { subtopicIdMap, subtopicOnlyMap, topicColorMap } =
    React.useMemo(() => {
      const idMap = new Map<string, string>();
      const subtopicOnly = new Map<string, string>();
      const colorMap = new Map<string, string>();
      topics.forEach((topic) => {
        if (topic.topicColor) {
          colorMap.set(topic.title, topic.topicColor);
        }
        topic.subtopics.forEach((subtopic) => {
          const key = `${topic.title}::${subtopic.title}`;
          idMap.set(key, subtopic.id);
          subtopicOnly.set(subtopic.title, subtopic.id);
        });
      });
      return {
        subtopicIdMap: idMap,
        subtopicOnlyMap: subtopicOnly,
        topicColorMap: colorMap,
      };
    }, [topics]);

  const getSubtopicId = React.useCallback(
    (topicTitle: string, subtopicTitle: string): string | null => {
      const exactMatch = subtopicIdMap.get(`${topicTitle}::${subtopicTitle}`);
      if (exactMatch) return exactMatch;
      return subtopicOnlyMap.get(subtopicTitle) ?? null;
    },
    [subtopicIdMap, subtopicOnlyMap],
  );

  const getTopicColor = React.useCallback(
    (topicTitle: string): string | undefined => {
      return topicColorMap.get(topicTitle);
    },
    [topicColorMap],
  );

  if (sortedCruxes.length === 0) return null;

  return (
    <Col gap={3}>
      <Col gap={2}>
        {sortedCruxes.map((crux, index) => (
          <ErrorBoundary
            key={`${getSubtopicId(crux.topic, crux.subtopic) || "crux"}-${index}`}
            fallback={() => (
              <div className="p-4 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground">
                Unable to display this crux
              </div>
            )}
          >
            <CruxCard
              crux={crux}
              getSubtopicId={getSubtopicId}
              getTopicColor={getTopicColor}
              onNavigateToSubtopic={onNavigateToSubtopic}
            />
          </ErrorBoundary>
        ))}
      </Col>
    </Col>
  );
}

function Appendix({
  rawPipelineOutput,
  filename,
}: {
  rawPipelineOutput: schema.PipelineOutput;
  filename: string;
}) {
  const handleDownload = () => {
    try {
      downloadReportData(rawPipelineOutput, filename);
    } catch (error) {
      toast.error(
        `Failed to download report data: ${(error as Error).message}`,
      );
    }
  };

  const prompts = rawPipelineOutput.promptsUsed;

  // Normalize line endings for comparison (stored prompts may have \r\n)
  const normalizePrompt = (s: string) => s.replace(/\r\n/g, "\n");
  const promptsMatch = (stored: string, defaultPrompt: string) =>
    normalizePrompt(stored) === normalizePrompt(defaultPrompt);

  return (
    <Col className="p-8 appendix-section print:hidden" gap={2}>
      <p className="p-medium">Appendix</p>
      <button
        type="button"
        className="text-muted-foreground underline cursor-pointer text-left"
        onClick={handleDownload}
      >
        Download report in JSON
      </button>

      {prompts && (
        <Col gap={2}>
          <p className="text-muted-foreground">
            AI Prompts used to generate this report:
          </p>
          <PromptToggle
            title="System prompt"
            content={prompts.systemInstructions}
            isDefault={promptsMatch(
              prompts.systemInstructions,
              defaultSystemPrompt,
            )}
            defaultContent={defaultSystemPrompt}
          />
          <PromptToggle
            title="Topics and subtopics prompt"
            content={prompts.clusteringInstructions}
            isDefault={promptsMatch(
              prompts.clusteringInstructions,
              defaultClusteringPrompt,
            )}
            defaultContent={defaultClusteringPrompt}
          />
          <PromptToggle
            title="Claim extraction prompt"
            content={prompts.extractionInstructions}
            isDefault={promptsMatch(
              prompts.extractionInstructions,
              defaultExtractionPrompt,
            )}
            defaultContent={defaultExtractionPrompt}
          />
          <PromptToggle
            title="Merging claims prompt"
            content={prompts.dedupInstructions}
            isDefault={promptsMatch(
              prompts.dedupInstructions,
              defaultDedupPrompt,
            )}
            defaultContent={defaultDedupPrompt}
          />
          <PromptToggle
            title="Summaries prompt"
            content={prompts.summariesInstructions}
            isDefault={promptsMatch(
              prompts.summariesInstructions,
              defaultSummariesPrompt,
            )}
            defaultContent={defaultSummariesPrompt}
          />
          {prompts.cruxInstructions && (
            <PromptToggle
              title="Cruxes prompt"
              content={prompts.cruxInstructions}
              isDefault={promptsMatch(
                prompts.cruxInstructions,
                defaultCruxPrompt,
              )}
              defaultContent={defaultCruxPrompt}
            />
          )}
        </Col>
      )}

      {rawPipelineOutput.auditLog && (
        <ProcessingSummary auditLog={rawPipelineOutput.auditLog} />
      )}
    </Col>
  );
}

export default Report;
