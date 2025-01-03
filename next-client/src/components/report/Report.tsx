"use client";

import React, {
  Dispatch,
  Ref,
  createContext,
  useContext,
  useEffect,
} from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { Col, Row } from "../layout";
import { Button, CardContent, Separator, TextIcon } from "../elements";
import Icons from "@assets/icons";
import { getNPeople } from "tttc-common/morphisms";
import useReportState, { ReportStateAction } from "./hooks/useReportState";
import { Sticky } from "../wrappers";
import { cn } from "@src/lib/utils/shadcn";
import Outline from "../outline/Outline";
import Theme from "../topic/Topic";
import useScrollListener from "./hooks/useScrollListener";
import useReportSubscribe from "./hooks/useReportSubscribe";
import { useFocusedNode as _useFocusedNode } from "./hooks/useFocusedNode";
import { useHashChange } from "@src/lib/hooks/useHashChange";

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
  // Allows side-effects from changes to ReportState
  useReportEffect: ReportActionEffect;
  // Tracks which node is being "focused"
  useFocusedNode: (id: string, ignore?: boolean) => Ref<HTMLDivElement>;
}>({
  dispatch: () => null,
  useScrollTo: () => ({}) as Ref<HTMLDivElement>,
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
  const [useScrollTo] = useScrollListener(useReportEffect);
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
      value={{ dispatch, useScrollTo, useReportEffect, useFocusedNode }}
    >
      {/* Wrapper div is here to just give some space at the bottom of the screen */}
      <div className="mb-36">
        {/* Toolbar is the component that has the open/close all buttons */}
        <ReportToolbar />
        <Row>
          {/* Outline component for navigation and keeping track of location. Wrapped in fixed div so it moves with screen. */}
          <div className="hidden lg:block ml-2 min-w-56 h-10" />
          <div className="fixed top-20 bottom-0 ml-2 hidden lg:block">
            <Outline reportState={state} reportDispatch={dispatch} />
          </div>
          {/* Main body */}
          <Col gap={4} className=" w-full md:max-w-[896px] m-auto">
            <ReportHeader reportData={reportData} />
            {state.children.map((themeNode) => (
              <Theme key={themeNode.data.id} node={themeNode} />
            ))}
          </Col>
          <div className="hidden lg:block mr-2 min-w-56 h-10" />
        </Row>
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
    <Sticky
      className={cn(`z-50 w-full dark:bg-background bg-white`)}
      stickyClass="border-b shadow-sm"
    >
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
    </Sticky>
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
      <Col gap={3}>
        {/* Contains summary stats and title */}
        <ReportTitle
          title={reportData.title}
          nThemes={themes.length}
          nTopics={topics.length}
          nClaims={claims.length}
          nPeople={nPeople}
          dateStr={dateStr}
        />
        {/* Description */}
        <p>{reportData.description}</p>
      </Col>
    </CardContent>
  );
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
}: {
  title: string;
  nClaims: number;
  nTopics: number;
  nThemes: number;
  nPeople: number;
  dateStr: string;
}) {
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

        <Row gap={4} className="h-5">
          {/* Number of people */}
          <TextIcon icon={<Icons.People size={16} className="self-center" />}>
            {/* {nPeople} people */} {/* ! temp removed for QA testing*/}
            416 participants
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
      </Row>
    </Col>
  );
}

export default Report;
