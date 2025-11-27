"use client";

import React, {
  Dispatch,
  Ref,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import * as schema from "tttc-common/schema";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { Col, Row } from "../layout";
import {
  Button,
  CardContent,
  Separator,
  Sheet,
  SheetContent,
  SheetTitle,
  TextIcon,
  ToggleText,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../elements";
import Icons from "@/assets/icons";
import { getNPeople } from "tttc-common/morphisms";
import { useReportState, ReportStateAction } from "./hooks/useReportState";
import { Sticky } from "../wrappers";
import { cn } from "@/lib/utils/shadcn";
import Outline from "../outline/Outline";
import {
  getTopicControversy,
  getControversyColors,
  formatControversyScore,
  getSortedCruxes,
  findSubtopicId,
} from "@/lib/crux/utils";
import Theme from "../topic/Topic";
import useScrollListener from "./hooks/useScrollListener";
import useReportSubscribe from "./hooks/useReportSubscribe";

/**
 * Delay in milliseconds to wait for tab switch and topic/subtopic expansion
 * before scrolling to the target element
 */
const TAB_SWITCH_DELAY_MS = 150;
import { useFocusedNode as _useFocusedNode } from "./hooks/useFocusedNode";
import { useNavbarVisibility } from "./hooks/useNavbarVisibility";
import { useHashChange } from "@/lib/hooks/useHashChange";
import { BarChart, BarChartItemType } from "../barchart/Barchart";
import { toast } from "sonner";
import {
  OutlineStateAction,
  useOutlineState,
} from "../outline/hooks/useOutlineState";
import { downloadReportData } from "@/lib/report/downloadUtils";

const ToolBarFrame = ({
  children,
  className,
  stickyClass,
}: React.PropsWithChildren<{ className?: string; stickyClass?: string }>) => (
  <Sticky
    className={cn(
      `z-40 w-full dark:bg-background bg-white pointer-events-auto`,
      className,
    )}
    stickyClass={cn("border-b shadow-sm pointer-events-auto", stickyClass)}
  >
    {children}
  </Sticky>
);

function ReportLayout({
  Outline,
  Report,
  ToolBar,
  isMobileOutlineOpen,
  setIsMobileOutlineOpen,
  navbarState,
}: {
  Outline: React.ReactNode;
  Report: React.ReactNode;
  ToolBar: React.ReactNode;
  isMobileOutlineOpen: boolean;
  setIsMobileOutlineOpen: (val: boolean) => void;
  navbarState: { isVisible: boolean; height: number };
}) {
  return (
    <Row className="flex w-full min-h-screen">
      {/* Outline section */}
      <Col className="hidden md:block min-w-[279px] flex-grow">
        <ToolBarFrame className="opacity-0" stickyClass="opacity-100">
          <div className="w-full h-14" />
        </ToolBarFrame>
        <div className="sticky top-20">{Outline}</div>
      </Col>

      <Sheet open={isMobileOutlineOpen} onOpenChange={setIsMobileOutlineOpen}>
        <SheetContent side={"left"} className="px-0 pt-0 top-0 max-w-[280px]">
          <div
            className="border-t border-l border-slate-200 h-[calc(100vh-theme(spacing.14))] transition-all duration-200 pt-4 pr-2"
            style={{
              marginTop: navbarState.isVisible
                ? `${navbarState.height + 56}px`
                : "56px", // 56px is toolbar height (h-14)
              height: navbarState.isVisible
                ? `calc(100vh - ${navbarState.height + 56}px)`
                : "calc(100vh - 56px)",
            }}
          >
            {/* Sheet title here is a requirement for visually impaired users. Won't show up visually. */}
            <SheetTitle className="sr-only">Outline</SheetTitle>
            {Outline}
          </div>
        </SheetContent>
      </Sheet>

      {/* Body section */}
      <Col className="flex-grow max-w-[896px] mx-auto w-full">
        <ToolBarFrame>{ToolBar}</ToolBarFrame>
        {Report}
      </Col>

      {/* Right section */}
      <Col className="flex-grow hidden sm:block">
        <ToolBarFrame className="opacity-0" stickyClass="opacity-100">
          <div className="w-full h-14" />
        </ToolBarFrame>
      </Col>
    </Row>
  );
}

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
  // Add-ons data from pipeline (including cruxes and controversy scores)
  addOns?: schema.AddOns;
  // Whether to sort topics by controversy score
  sortByControversy: boolean;
  setSortByControversy: Dispatch<SetStateAction<boolean>>;
  // ID of crux that should be auto-expanded (e.g., when navigating from Cruxes tab)
  expandedCruxId: string | null;
  setExpandedCruxId: Dispatch<SetStateAction<string | null>>;
}>({
  dispatch: () => null,
  useScrollTo: () => ({}) as Ref<HTMLDivElement>,
  setScrollTo: () => null,
  useReportEffect: () => {},
  useFocusedNode: () => ({}) as Ref<HTMLDivElement>,
  addOns: undefined,
  sortByControversy: false,
  setSortByControversy: () => null,
  expandedCruxId: null,
  setExpandedCruxId: () => null,
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
  const useFocusedNode = _useFocusedNode((id: string) =>
    dispatch({ type: "focus", payload: { id } }),
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

  // Sort by controversy state
  const [sortByControversy, setSortByControversy] = useState<boolean>(false);

  // State for tracking which crux should be auto-expanded
  const [expandedCruxId, setExpandedCruxId] = useState<string | null>(null);

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

  return (
    <ReportContext.Provider
      value={{
        dispatch,
        useScrollTo,
        setScrollTo,
        useReportEffect,
        useFocusedNode,
        addOns,
        sortByControversy,
        setSortByControversy,
        expandedCruxId,
        setExpandedCruxId,
      }}
    >
      {/* Wrapper div is here to just give some space at the bottom of the screen */}
      <div className="mb-36">
        <ReportLayout
          isMobileOutlineOpen={isMobileOutlineOpen}
          setIsMobileOutlineOpen={setIsMobileOutlineOpen}
          navbarState={navbarState}
          Report={
            <Col gap={4} className="px-3">
              <ReportHeader
                topics={reportData.topics}
                date={reportData.date}
                title={reportData.title}
                description={reportData.description}
                questionAnswers={reportData.questionAnswers}
              />
              {sortedTopics.map((themeNode) => (
                <Theme key={themeNode.data.id} node={themeNode} />
              ))}
              <Appendix
                filename={reportData.title}
                rawPipelineOutput={rawPipelineOutput}
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
            />
          }
        />
      </div>
    </ReportContext.Provider>
  );
}

/**
 * Bar that follows down screen. Lets user do certain actions.
 */
export function ReportToolbar({
  setIsMobileOutlineOpen,
  isMobileOutlineOpen,
}: {
  setIsMobileOutlineOpen: (val: boolean) => void;
  isMobileOutlineOpen: boolean;
}) {
  const { dispatch, sortByControversy, setSortByControversy, addOns } =
    useContext(ReportContext);

  // Only show sort button if there's controversy data
  const hasControversyData =
    addOns?.topicScores && addOns.topicScores.length > 0;

  return (
    // Sticky keeps it at top of screen when scrolling down.

    <Row
      // ! make sure this is the same width as the theme cards.
      className={`p-2 justify-between w-full mx-auto`}
    >
      <Row gap={2}>
        <div>
          <Button
            onClick={() => setIsMobileOutlineOpen(!isMobileOutlineOpen)}
            className="sm:hidden p-3"
            variant={"outline"}
          >
            {isMobileOutlineOpen ? (
              <Icons.X2 className="fill-muted-foreground" />
            ) : (
              <Icons.MobileOutline className="size-4 fill-muted-foreground" />
            )}
          </Button>
        </div>
      </Row>
      <Row gap={2}>
        {/* Sort by controversy button */}
        {hasControversyData && (
          <Button
            onClick={() => setSortByControversy(!sortByControversy)}
            variant={sortByControversy ? "secondary" : "outline"}
          >
            {sortByControversy ? "Default order" : "Sort by controversy"}
          </Button>
        )}
        {/* Close all button */}
        <Button
          onClick={() => dispatch({ type: "closeAll" })}
          variant={"outline"}
        >
          Collapse all
        </Button>
        {/* Open all button  */}
        <Button
          onClick={() => dispatch({ type: "openAll" })}
          variant={"secondary"}
          data-testid={"open-all-button"}
        >
          Expand all
        </Button>
      </Row>
    </Row>
  );
}

/**
 * Header for Report that has some summary details.
 */
export function ReportHeader({
  topics: themes,
  date,
  title,
  description,
  questionAnswers,
}: {
  topics: schema.Topic[];
  date: string;
  title: string;
  description: string;
  questionAnswers?: schema.QuestionAnswer[];
}) {
  const topics = themes.flatMap((theme) => theme.subtopics);
  const claims = topics.flatMap((topic) => topic.claims);
  const nPeople = getNPeople(claims);
  const dateStr = date;
  const { addOns } = useContext(ReportContext);

  // Check if we have controversy data to show the cruxes tab
  const hasControversyData =
    addOns?.subtopicCruxes && addOns.subtopicCruxes.length > 0;

  return (
    <CardContent>
      <Col gap={8}>
        {/* Contains title and basic overview stats */}
        <ReportIntro
          title={title}
          nThemes={themes.length}
          nTopics={topics.length}
          nClaims={claims.length}
          nPeople={nPeople}
          dateStr={dateStr}
        />
        {/* Summary */}
        <ReportSummary
          description={description}
          questionAnswers={questionAnswers}
        />
        {/* Overview with optional Cruxes tab */}
        {hasControversyData ? (
          <ReportWithCruxes addOns={addOns} topics={themes} />
        ) : (
          <ReportOverview topics={themes} />
        )}
      </Col>
    </CardContent>
  );
}

interface IReportTitle {
  title: string;
  nClaims: number;
  nTopics: number;
  nThemes: number;
  nPeople: number;
  dateStr: string;
}

/**
 * Inside header - has summary stats and title
 */
export function ReportTitle({
  title,
  nClaims,
  nPeople,
  nThemes,
  nTopics,
  dateStr,
}: IReportTitle) {
  return (
    <Col gap={2} className="pb-1">
      {/* Title and copy button */}
      <Row gap={2} className="justify-between">
        <h3>
          <a id={`${title}`}>{title}</a>
        </h3>
        <CopyLinkButton anchor={title} />
      </Row>

      {/* Stat details. Split into two parts for easy wrapping */}
      <Row gap={4} className="flex-wrap gap-y-1">
        {/* Number of topics */}
        <TextIcon icon={<Icons.Theme size={16} className="self-center" />}>
          {nThemes} topics
        </TextIcon>
        {/* Number of subtopics */}
        <TextIcon icon={<Icons.Topic />}>{nTopics} subtopics</TextIcon>
        {/* Number of claims */}
        <TextIcon icon={<Icons.Claim />}>{nClaims} claims</TextIcon>
        {/* Separator */}
        <Separator
          orientation="vertical"
          className="hidden sm:block h-4 self-center"
        />
        {/* Number of people */}
        <TextIcon icon={<Icons.People size={16} className="self-center" />}>
          {nPeople} people
        </TextIcon>
        {/* Date */}
        <TextIcon icon={<Icons.Date size={16} className="self-center" />}>
          {Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }).format(new Date(dateStr))}
        </TextIcon>
      </Row>
    </Col>
  );
}

export function ReportIntro(props: IReportTitle) {
  return (
    <Col gap={1}>
      <ReportTitle {...props} />
      <ReportInfo />
    </Col>
  );
}

export function ReportInfo() {
  const [show, setShow] = useState<boolean>(true);

  return (
    <Row
      gap={2}
      className={`p-4 border rounded items-center ${show ? "" : "hidden"}`}
    >
      <div>
        <Icons.Lightbulb />
      </div>
      <p className="p2 text-muted-foreground">
        Talk to the City takes the text from large group discussions and turns
        it into a summary report using AI prompting. Learn more on the About
        page.
      </p>
      <Button
        variant={"ghost"}
        size={"icon"}
        onClick={() => setShow(false)}
        className="h-10 w-10"
      >
        <div>
          <Icons.X />
        </div>
      </Button>
    </Row>
  );
}

export function ReportSummary({
  description,
  questionAnswers,
}: {
  description: string;
  questionAnswers?: schema.QuestionAnswer[];
}) {
  return (
    <Col gap={3}>
      {/* Summary Title */}
      <Col gap={1}>
        <h4>Summary</h4>
        <Row
          gap={2}
          className="items-center text-muted-foreground fill-muted-foreground"
        >
          <div>
            <Icons.Info className="h-4 w-4" />
          </div>
          <p className="p2 text-muted-foreground flex gap-2 items-center ">
            The summary is written by the report creators, while the rest is
            AI-generated, excluding quotes.
          </p>
        </Row>
      </Col>
      {/* Summary Description */}
      <div>{description}</div>

      {/* Summary Meta Questions */}

      {questionAnswers?.map((qa) => (
        <ToggleText>
          <ToggleText.Title>{qa.question}</ToggleText.Title>
          <ToggleText.Content>{qa.answer}</ToggleText.Content>
        </ToggleText>
      ))}
    </Col>
  );
}

export function ReportOverview({ topics }: { topics: schema.Topic[] }) {
  const getBarChartEntries = (topics: schema.Topic[]): BarChartItemType[] => {
    const largestN = topics.reduce((accum, curr) => {
      const nClaims = getNPeople(curr.subtopics);
      return Math.max(nClaims, accum);
    }, 0);

    return topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      percentFill: getNPeople(topic.subtopics) / largestN,
      subtitle: `${getNPeople(topic.subtopics)} people`,
      color: topic.topicColor,
    }));
  };

  return (
    <Col gap={3}>
      <h4>Overview</h4>
      <BarChart entries={getBarChartEntries(topics)} />
    </Col>
  );
}

type Tab = "overview" | "cruxes";

function ReportWithCruxes({
  addOns,
  topics,
}: {
  addOns?: schema.AddOns;
  topics: schema.Topic[];
}) {
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const { dispatch } = useContext(ReportContext);

  const handleNavigateToSubtopic = (subtopicId: string) => {
    // Switch to overview tab
    setActiveTab("overview");

    // Expand the topic and subtopic
    dispatch({ type: "open", payload: { id: subtopicId } });
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as Tab)}
    >
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="cruxes">Cruxes</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <ReportOverview topics={topics} />
      </TabsContent>
      <TabsContent value="cruxes">
        <CruxesOverview
          addOns={addOns}
          topics={topics}
          onNavigateToSubtopic={handleNavigateToSubtopic}
        />
      </TabsContent>
    </Tabs>
  );
}

/**
 * Displays a list of all cruxes (controversial points) in the report,
 * sorted by controversy score (highest first).
 *
 * @param addOns - Optional pipeline add-ons containing crux data
 * @param topics - List of topics for navigation lookup
 * @param onNavigateToSubtopic - Optional callback to navigate to a specific subtopic when crux is clicked
 * @returns null if no cruxes are available, otherwise renders sorted list of clickable crux cards
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

  // Build lookup map once to avoid O(N×M×P) nested loops in render
  // Critical for performance when reports have many cruxes
  const subtopicIdMap = React.useMemo(() => {
    const map = new Map<string, string>();
    topics.forEach((topic) => {
      topic.subtopics.forEach((subtopic) => {
        const key = `${topic.title}::${subtopic.title}`;
        map.set(key, subtopic.id);
      });
    });
    return map;
  }, [topics]);

  const getSubtopicId = React.useCallback(
    (topicTitle: string, subtopicTitle: string): string | null => {
      return subtopicIdMap.get(`${topicTitle}::${subtopicTitle}`) ?? null;
    },
    [subtopicIdMap],
  );

  if (sortedCruxes.length === 0) return null;

  return (
    <Col gap={3}>
      <h4>Cruxes</h4>
      <Col gap={2}>
        {sortedCruxes.map((crux, index) => (
          <CruxCard
            key={getSubtopicId(crux.topic, crux.subtopic) || `crux-${index}`}
            crux={crux}
            getSubtopicId={getSubtopicId}
            onNavigateToSubtopic={onNavigateToSubtopic}
          />
        ))}
      </Col>
    </Col>
  );
}

function CruxCard({
  crux,
  getSubtopicId,
  onNavigateToSubtopic,
}: {
  crux: schema.SubtopicCrux;
  getSubtopicId: (topicTitle: string, subtopicTitle: string) => string | null;
  onNavigateToSubtopic?: (subtopicId: string) => void;
}) {
  const { setScrollTo, setExpandedCruxId } = useContext(ReportContext);
  const colors = getControversyColors(crux.controversyScore);
  const subtopicId = getSubtopicId(crux.topic, crux.subtopic);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    // Ensure both subtopicId and navigation callback exist
    if (!subtopicId) {
      console.warn(
        `[CruxCard] Cannot navigate: subtopic not found for topic="${crux.topic}", subtopic="${crux.subtopic}"`,
      );
      return;
    }
    if (!onNavigateToSubtopic) {
      console.warn(
        `[CruxCard] Cannot navigate: onNavigateToSubtopic callback not provided`,
      );
      return;
    }

    // Set which crux should be auto-expanded (using topic:subtopic as unique ID)
    setExpandedCruxId(`${crux.topic}:${crux.subtopic}`);

    // Switch to overview tab and expand topic/subtopic
    onNavigateToSubtopic(subtopicId);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Delay to ensure tab switch and expansion complete before scrolling
    timeoutRef.current = setTimeout(() => {
      setScrollTo([subtopicId, Date.now()]);
      timeoutRef.current = null;
    }, TAB_SWITCH_DELAY_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const ariaLabel = `Navigate to ${crux.topic}, ${crux.subtopic}: ${crux.cruxClaim}. Controversy score ${formatControversyScore(crux.controversyScore)}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`p-3 rounded-md border-l-4 ${colors.border} ${colors.bg} cursor-pointer hover:opacity-75 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <Col gap={2}>
        <Row gap={2} className="justify-between items-start">
          <div className="flex-grow">
            <p className="font-medium text-sm">
              {crux.topic} → {crux.subtopic}
            </p>
            <p className="text-sm text-gray-700 mt-1">{crux.cruxClaim}</p>
          </div>
          <span
            className={`text-xs ${colors.bg} ${colors.text} px-2 py-0.5 rounded-full whitespace-nowrap`}
          >
            {formatControversyScore(crux.controversyScore)}
          </span>
        </Row>
        <Row gap={3} className="text-xs text-muted-foreground">
          <span className="text-green-700">{crux.agree.length} agree</span>
          <span className="text-red-700">{crux.disagree.length} disagree</span>
          <span className="text-gray-600">
            {crux.no_clear_position?.length || 0} unclear
          </span>
        </Row>
      </Col>
    </div>
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

  return (
    <Col className="p-8" gap={1}>
      <p className="p-medium">Appendix</p>
      <p
        className="text-muted-foreground underline cursor-pointer"
        onClick={handleDownload}
      >
        Download report in JSON
      </p>
    </Col>
  );
}

export default Report;
