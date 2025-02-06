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
import Icons from "@assets/icons";
import { getNClaims, getNPeople } from "tttc-common/morphisms";
import useReportState, { ReportStateAction } from "./hooks/useReportState";
import { Sticky } from "../wrappers";
import { cn } from "@src/lib/utils/shadcn";
import Outline from "../outline/Outline";
import Theme from "../topic/Topic";
import useScrollListener from "./hooks/useScrollListener";
import useReportSubscribe from "./hooks/useReportSubscribe";
import { useFocusedNode as _useFocusedNode } from "./hooks/useFocusedNode";
import { useHashChange } from "@src/lib/hooks/useHashChange";
import { BarChart, BarChartItemType } from "../barchart/Barchart";

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
  Body,
  ToolBar,
}: {
  Outline: React.ReactNode;
  Body: React.ReactNode;
  ToolBar: React.ReactNode;
}) {
  return (
    <Col>
      <Row>
        {/* Left Section */}
        <Col className="flex-grow bg-secondary">
          {/* Section to make appearance of full width toolbar */}
          <ToolBarFrame className="opacity-0" stickyClass="opacity-100">
            <div className="opacity-0 py-2">
              <Button className="w-0 p-0 m-0"></Button>
            </div>
          </ToolBarFrame>
          <div className="hidden md:block">{Outline}</div>
        </Col>

        {/* Main */}
        <Col className="w-full md:max-w-[896px] px-3 sm:px-0">
          <ToolBarFrame>{ToolBar}</ToolBarFrame>
          {Body}
        </Col>

        {/* Right Section */}
        <Col className="flex-grow bg-primary">
          {/* Section to make appearance of full width toolbar */}
          <ToolBarFrame className="opacity-0" stickyClass="opacity-100">
            <div className="opacity-0 py-2">
              <Button className="w-0 p-0 m-0"></Button>
            </div>
          </ToolBarFrame>
        </Col>
      </Row>
    </Col>
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
function Report({ reportData }: { reportData: schema.ReportDataObj }) {
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
        {/* Toolbar is the component that has the open/close all buttons */}
        {/* <ReportToolbar /> */}
        {/* <Row> */}
        {/* Outline component for navigation and keeping track of location. Wrapped in fixed div so it moves with screen. */}
        {/* <div className="hidden lg:block ml-2 min-w-56 h-10" />
          <div className="fixed top-20 bottom-0 ml-2 hidden lg:block">
            <Outline reportState={state} reportDispatch={dispatch} />
          </div> */}
        {/* Main body */}
        {/* <Col gap={4} className=" w-full md:max-w-[896px] m-auto px-3 sm:px-0">
            <ReportHeader reportData={reportData} />
            {state.children.map((themeNode) => (
              <Theme key={themeNode.data.id} node={themeNode} />
            ))}
          </Col>
          <div className="hidden lg:block mr-2 min-w-56 h-10" />
        </Row> */}
        <ReportLayout
          Body={
            <Col
              gap={4}
              // className=" w-full md:max-w-[896px] m-auto px-3 sm:px-0"
            >
              <ReportHeader reportData={reportData} />
              {state.children.map((themeNode) => (
                <Theme key={themeNode.data.id} node={themeNode} />
              ))}
            </Col>
          }
          ToolBar={<ReportToolbar />}
          Outline={
            // <div className="hidden lg:block ml-2 min-w-56 h-10">
            //   <div className="fixed top-20 bottom-0 ml-2 hidden lg:block">
            <Outline reportState={state} reportDispatch={dispatch} />
            //   </div>
            // </div>
          }
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
      className={`p-2 justify-between w-full md:max-w-[896px] mx-auto`}
    >
      <div>
        <Button variant={"outline"}>Edit</Button>
      </div>
      <Row gap={2}>
        {/* Close all button */}
        <Button
          onClick={() => dispatch({ type: "closeAll", payload: { id: "" } })}
          variant={"outline"}
        >
          Collapse all
        </Button>
        {/* Open all button  */}
        <Button
          onClick={() => dispatch({ type: "openAll", payload: { id: "" } })}
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
  reportData,
}: {
  reportData: schema.ReportDataObj;
}) {
  const themes = reportData.topics;
  const topics = themes.flatMap((theme) => theme.subtopics);
  const claims = topics.flatMap((topic) => topic.claims);
  const nPeople = getNPeople(claims);
  const dateStr = reportData.date;
  return (
    <CardContent>
      <Col gap={8}>
        {/* Contains title and basic overview stats */}
        <ReportIntro
          title={reportData.title}
          nThemes={themes.length}
          nTopics={topics.length}
          nClaims={claims.length}
          nPeople={nPeople}
          dateStr={dateStr}
        />
        {/* Summary */}
        <ReportSummary reportData={reportData} />
        {/* Overview */}
        <ReportOverview topics={reportData.topics} />
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
        it into a summary report using AI prompting. Go to input tab to see the
        raw text, AI model and prompts used. Learn more in the About page.
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
  reportData,
}: {
  reportData: schema.ReportDataObj;
}) {
  const { description, questionAnswers } = reportData;
  return (
    <Col gap={3}>
      {/* Summary Title */}
      <Col gap={1}>
        <h4>Summary</h4>
        <TextIcon icon={<Icons.Info />}>
          <p className="p2 text-muted-foreground">
            The summary is written by the report creators, while the rest is
            AI-generated, exluding quotes.
          </p>
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
      const nClaims = getNClaims(curr.subtopics);
      return Math.max(nClaims, accum);
    }, 0);

    return topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      percentFill: getNClaims(topic.subtopics) / largestN,
      subtitle: `${getNClaims(topic.subtopics)} claims`,
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

export default Report;
