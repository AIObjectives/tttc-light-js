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
  TextIcon,
  ToggleText,
} from "../elements";
import Icons from "@/assets/icons";
import { getNPeople } from "tttc-common/morphisms";
import useReportState, { ReportStateAction } from "./hooks/useReportState";
import { Sticky } from "../wrappers";
import { cn } from "@/lib/utils/shadcn";
import Outline from "../outline/Outline";
import Theme from "../topic/Topic";
import useScrollListener from "./hooks/useScrollListener";
import useReportSubscribe from "./hooks/useReportSubscribe";
import { useFocusedNode as _useFocusedNode } from "./hooks/useFocusedNode";
import { useHashChange } from "@/lib/hooks/useHashChange";
import { BarChart, BarChartItemType } from "../barchart/Barchart";
import { toast } from "sonner";

const ToolBarFrame = ({
  children,
  className,
  stickyClass,
}: React.PropsWithChildren<{ className?: string; stickyClass?: string }>) => (
  <Sticky
    className={cn(`z-50 w-full dark:bg-background bg-white`, className)}
    stickyClass={cn("border-b shadow-sm", stickyClass)}
  >
    {children}
  </Sticky>
);

function ReportLayout({
  Outline,
  Report,
  ToolBar,
}: {
  Outline: React.ReactNode;
  Report: React.ReactNode;
  ToolBar: React.ReactNode;
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
}>({
  dispatch: () => null,
  useScrollTo: () => ({}) as Ref<HTMLDivElement>,
  setScrollTo: () => null,
  useReportEffect: () => {},
  useFocusedNode: () => ({}) as Ref<HTMLDivElement>,
});

/**
 * Report feature
 */
function Report({
  reportData,
  reportUri,
}: {
  reportData: schema.UIReportData;
  reportUri: string;
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

  return (
    <ReportContext.Provider
      value={{
        dispatch,
        useScrollTo,
        setScrollTo,
        useReportEffect,
        useFocusedNode,
      }}
    >
      {/* Wrapper div is here to just give some space at the bottom of the screen */}
      <div className="mb-36">
        <ReportLayout
          Report={
            <Col gap={4} className="px-3">
              <ReportHeader
                topics={reportData.topics}
                date={reportData.date}
                title={reportData.title}
                description={reportData.description}
                questionAnswers={reportData.questionAnswers}
              />
              {state.children.map((themeNode) => (
                <Theme key={themeNode.data.id} node={themeNode} />
              ))}
              <Appendix filename={reportData.title} reportUri={reportUri} />
            </Col>
          }
          ToolBar={<ReportToolbar />}
          Outline={<Outline reportState={state} reportDispatch={dispatch} />}
        />
      </div>
    </ReportContext.Provider>
  );
}

/**
 * Bar that follows down screen. Lets user do certain actions.
 */
export function ReportToolbar() {
  const { dispatch } = useContext(ReportContext);
  return (
    // Sticky keeps it at top of screen when scrolling down.

    <Row
      // ! make sure this is the same width as the theme cards.
      className={`p-2 justify-between w-full mx-auto`}
    >
      <div>
        <Button variant={"outline"}>Edit</Button>
      </div>
      <Row gap={2}>
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
        {/* Overview */}
        <ReportOverview topics={themes} />
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
  function ReportTitleIconsLeft() {
    return (
      <Row gap={4} className="h-5">
        {/* Number of topics */}
        <TextIcon icon={<Icons.Theme size={16} className="self-center" />}>
          {nThemes} topics
        </TextIcon>
        {/* Number of subtopics */}
        <TextIcon icon={<Icons.Topic />}>{nTopics} subtopics</TextIcon>
        {/* Number of claims */}
        <TextIcon icon={<Icons.Claim />}>{nClaims} claims</TextIcon>
        <Separator orientation="vertical" />
      </Row>
    );
  }

  function ReportTitleIconsRight() {
    return (
      <Row gap={4} className="h-5">
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
    );
  }

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
      <Row gap={4} className="min-h-5 flex-wrap gap-y-2">
        <ReportTitleIconsLeft />
        <ReportTitleIconsRight />
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
        <TextIcon icon={<Icons.Info />}>
          The summary is written by the report creators, while the rest is
          AI-generated, excluding quotes.
        </TextIcon>
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

function Appendix({
  reportUri,
  filename,
}: {
  reportUri: string;
  filename: string;
}) {
  const handleDownload = async () => {
    console.log(reportUri);
    try {
      const fetchUrl = `/api/report/download/${encodeURIComponent(reportUri)}`;
      const response = await fetch(fetchUrl, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        toast.error("An error occured: could not download report data");
        return;
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename + "-" + Date.now();

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(downloadUrl);
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
