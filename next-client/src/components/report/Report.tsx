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
  useState,
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
import {
  Button,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorBoundary,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../elements";
import { Col, Row } from "../layout";
import {
  type OutlineStateAction,
  useOutlineState,
} from "../outline/hooks/useOutlineState";
import Outline from "../outline/Outline";
import Theme from "../topic/Topic";
import { CruxCard } from "./CruxCard";
import { ProcessingSummary } from "./components/ProcessingSummary";
import { PromptToggle } from "./components/PromptToggle";
import { ReportHeader } from "./components/ReportHeader";
// Extracted components
import { ReportLayout } from "./components/ReportLayout";
import { ReportToolbar } from "./components/ReportToolbar";
import { useFocusedNode as _useFocusedNode } from "./hooks/useFocusedNode";
import { useNavbarVisibility } from "./hooks/useNavbarVisibility";
import {
  type ReportStateAction,
  type TopicNode,
  useReportState,
} from "./hooks/useReportState";
import useReportSubscribe from "./hooks/useReportSubscribe";
import useScrollListener from "./hooks/useScrollListener";

/**
 * Report Component
 *
 * This is the highest level component for /report/
 * This not only sets up the correct components, but initializes much of the state management for this feature.
 */

/**
 * TYPES
 */
type ReportActionEffectFunc = (action: ReportStateAction) => void;
type ReportActionEffect = (func: ReportActionEffectFunc) => void;

/**
 * Sort mode for unified sort dropdown
 * - "frequent": Default sort by claim frequency (no special sorting)
 * - "controversy": Sort topics by controversy score
 * - "bridging": Sort claims by bridging potential
 */
export type SortMode = "frequent" | "controversy" | "bridging";

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
  setSortMode: Dispatch<SetStateAction<SortMode>>;
  // Derived booleans for backward compatibility with sorting logic
  sortByControversy: boolean;
  sortByBridging: boolean;
  // ID of crux that should be auto-expanded (e.g., when navigating from Cruxes tab)
  expandedCruxId: string | null;
  setExpandedCruxId: Dispatch<SetStateAction<string | null>>;
  // Active content tab ("report" or "cruxes")
  activeContentTab: "report" | "cruxes";
  setActiveContentTab: Dispatch<SetStateAction<"report" | "cruxes">>;
  // Get topic color by topic title
  getTopicColor: (topicTitle: string) => string | undefined;
  // Get subtopic ID by topic and subtopic titles
  getSubtopicId: (topicTitle: string, subtopicTitle: string) => string | null;
  // ID of currently focused/highlighted crux (for outline highlighting)
  focusedCruxId: string | null;
}>({
  dispatch: () => null,
  useScrollTo: () => ({}) as Ref<HTMLDivElement>,
  setScrollTo: () => null,
  useReportEffect: () => {},
  useFocusedNode: () => ({}) as Ref<HTMLDivElement>,
  useFocusedNodeForCruxes: () => ({}) as Ref<HTMLDivElement>,
  suppressFocusTracking: () => {},
  addOns: undefined,
  sortMode: "frequent",
  setSortMode: () => null,
  sortByControversy: false,
  sortByBridging: false,
  expandedCruxId: null,
  setExpandedCruxId: () => null,
  activeContentTab: "report",
  setActiveContentTab: () => null,
  getTopicColor: () => undefined,
  getSubtopicId: () => null,
  focusedCruxId: null,
});

/**
 * Report feature
 */
function Report({
  reportData,
  reportUri,
  rawPipelineOutput,
}: {
  reportData: schema.UIReportData;
  reportUri: string;
  rawPipelineOutput: schema.PipelineOutput;
}) {
  // Report State reducer
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
  // Track focused crux for outline highlighting
  const [focusedCruxId, setFocusedCruxId] = useState<string | null>(null);
  const [useFocusedNodeForCruxes] = _useFocusedNode((id: string) =>
    setFocusedCruxId(id),
  );
  // Track navbar visibility for sheet positioning
  const navbarState = useNavbarVisibility();
  useEffect(() => {
    if (!hashNav) return;
    const nodes = [
      ...state.children.map((topic) => topic),
      ...state.children.flatMap((topic) => topic.children.map((sub) => sub)),
      ...state.children.flatMap((topic) =>
        topic.children.flatMap((sub) => sub.children.map((clm) => clm)),
      ),
    ];
    const matchingNode = nodes.find((node) => node.data.title === hashNav);
    if (!matchingNode) return;
    dispatch({ type: "open", payload: { id: matchingNode.data.id } });
  }, [hashNav]);

  const [isMobileOutlineOpen, setIsMobileOutlineOpen] =
    useState<boolean>(false);

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

  // Unified sort mode state
  const [sortMode, setSortMode] = useState<SortMode>("frequent");

  // Derive booleans for backward compatibility with sorting logic
  const sortByControversy = sortMode === "controversy";
  const sortByBridging = sortMode === "bridging";

  // State for tracking which crux should be auto-expanded
  const [expandedCruxId, setExpandedCruxId] = useState<string | null>(null);

  // Active content tab ("report" or "cruxes")
  const [activeContentTab, setActiveContentTab] = useState<"report" | "cruxes">(
    "report",
  );

  // Extract addOns to avoid rawPipelineOutput object reference changes breaking memoization
  const addOns = React.useMemo(
    () => rawPipelineOutput.data[1]?.addOns,
    [rawPipelineOutput.data],
  );

  // Sort topics if sortByControversy is enabled
  const sortedTopics = React.useMemo(() => {
    if (!sortByControversy) {
      return state.children;
    }

    return [...state.children].sort((a, b) => {
      const scoreA = getTopicControversy(addOns, a.data?.title) ?? -1;
      const scoreB = getTopicControversy(addOns, b.data?.title) ?? -1;
      // Sort descending (highest controversy first)
      return scoreB - scoreA;
    });
  }, [sortByControversy, state.children, addOns]);

  // Build topic color map for AgreeDisagreeSpectrum
  const topicColorMap = React.useMemo(() => {
    const colorMap = new Map<string, string>();
    state.children.forEach((topic) => {
      if (topic.data?.topicColor) {
        colorMap.set(topic.data.title, topic.data.topicColor);
      }
    });
    return colorMap;
  }, [state.children]);

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
    state.children.forEach((topic) => {
      topic.data.subtopics.forEach((subtopic) => {
        idMap.set(`${topic.data.title}::${subtopic.title}`, subtopic.id);
        subtopicOnly.set(subtopic.title, subtopic.id);
      });
    });
    return { idMap, subtopicOnly };
  }, [state.children]);

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
    <ReportContext.Provider
      value={{
        dispatch,
        useScrollTo,
        setScrollTo,
        useReportEffect,
        useFocusedNode,
        useFocusedNodeForCruxes,
        suppressFocusTracking,
        addOns,
        sortMode,
        setSortMode,
        sortByControversy,
        sortByBridging,
        expandedCruxId,
        setExpandedCruxId,
        activeContentTab,
        setActiveContentTab,
        getTopicColor,
        getSubtopicId,
        focusedCruxId,
      }}
    >
      {/* Wrapper div is here to just give some space at the bottom of the screen */}
      <div className="mb-36">
        <ReportLayout
          isMobileOutlineOpen={isMobileOutlineOpen}
          setIsMobileOutlineOpen={setIsMobileOutlineOpen}
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
              setIsMobileOutlineOpen={setIsMobileOutlineOpen}
              isMobileOutlineOpen={isMobileOutlineOpen}
            />
          }
          Outline={
            <Outline
              outlineState={outlineState}
              outlineDispatch={outlineDispatch}
              reportDispatch={dispatch}
              onNavigate={() => setIsMobileOutlineOpen(false)}
            />
          }
        />
      </div>
    </ReportContext.Provider>
  );
}

type ContentTab = "report" | "cruxes";

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
  const {
    dispatch,
    sortMode,
    setSortMode,
    activeContentTab,
    setActiveContentTab,
  } = useContext(ReportContext);

  // Check if we have controversy data
  const hasControversyData =
    addOns?.subtopicCruxes && addOns.subtopicCruxes.length > 0;

  // Check if we have bridging data
  const hasBridgingData =
    addOns?.claimBridgingScores && addOns.claimBridgingScores.length > 0;

  // Helper to get sort label for button
  const getSortLabel = (mode: SortMode): string => {
    switch (mode) {
      case "controversy":
        return "Controversy";
      case "bridging":
        return "Bridging statements";
      default:
        return "Frequent claims";
    }
  };

  const handleNavigateToSubtopic = (subtopicId: string) => {
    // Switch to report tab
    setActiveContentTab("report");

    // Expand the topic and subtopic
    dispatch({ type: "open", payload: { id: subtopicId } });
  };

  // Track the source of tab changes to prevent circular updates between URL and state
  const tabChangeSource = useRef<"user" | "hash">("user");

  // URL hash synchronization constants
  const HASH_SYNC_DEBOUNCE_MS = 50; // Debounce browser back/forward spam

  // Effect 1: Sync tab from URL hash (URL → State)
  // This handles initial load and browser back/forward navigation
  useEffect(() => {
    let debounceTimeout: number | null = null;

    const syncFromHash = () => {
      // Clear any pending debounce
      if (debounceTimeout) clearTimeout(debounceTimeout);

      debounceTimeout = setTimeout(() => {
        try {
          const hash = window.location.hash.slice(1);
          const expectedTab: ContentTab =
            hash === "cruxes" && hasControversyData ? "cruxes" : "report";

          // Mark this update as coming from hash to prevent circular updates
          tabChangeSource.current = "hash";

          // Only update if tab needs to change
          setActiveContentTab((current) => {
            // Force report tab if controversy data disappeared
            if (!hasControversyData && current === "cruxes") {
              return "report";
            }
            // Update tab to match hash
            return expectedTab !== current ? expectedTab : current;
          });
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error syncing tab from hash:", error);
          }
        }
        debounceTimeout = null;
      }, HASH_SYNC_DEBOUNCE_MS) as unknown as number;
    };

    // Sync from URL on mount
    syncFromHash();

    // Listen for hash changes (browser back/forward)
    window.addEventListener("hashchange", syncFromHash);

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, [hasControversyData, setActiveContentTab]);

  // Effect 2: Update URL when tab changes (State → URL)
  // This handles user clicking on tab switches
  useEffect(() => {
    // Skip URL update if change came from hash sync (prevents circular updates)
    if (tabChangeSource.current === "hash") {
      tabChangeSource.current = "user"; // Reset for next update
      return;
    }

    const currentHash = window.location.hash.slice(1);
    const expectedHash = activeContentTab === "cruxes" ? "cruxes" : "";

    // Only update URL if it doesn't match current state
    if (currentHash !== expectedHash) {
      if (expectedHash) {
        window.history.pushState(null, "", `#${expectedHash}`);
      } else {
        // Remove hash when on report tab
        window.history.pushState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
    }
  }, [activeContentTab]);

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
          {activeContentTab === "report" &&
            (hasControversyData || hasBridgingData) && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Sort by</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {getSortLabel(sortMode)}
                      <ChevronsUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setSortMode("frequent")}
                      className={cn(
                        "cursor-pointer",
                        sortMode === "frequent" && "bg-accent",
                      )}
                    >
                      Frequent claims
                    </DropdownMenuItem>
                    {hasControversyData && (
                      <DropdownMenuItem
                        onClick={() => setSortMode("controversy")}
                        className={cn(
                          "cursor-pointer",
                          sortMode === "controversy" && "bg-accent",
                        )}
                      >
                        Controversy
                      </DropdownMenuItem>
                    )}
                    {hasBridgingData && (
                      <DropdownMenuItem
                        onClick={() => setSortMode("bridging")}
                        className={cn(
                          "cursor-pointer",
                          sortMode === "bridging" && "bg-accent",
                        )}
                      >
                        Bridging statements
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
      <p
        className="text-muted-foreground underline cursor-pointer"
        onClick={handleDownload}
      >
        Download report in JSON
      </p>

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
