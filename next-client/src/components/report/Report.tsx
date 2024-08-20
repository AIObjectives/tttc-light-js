"use client";

import React, { Dispatch, Ref, createContext, useContext } from "react";
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

type ReportActionEffectFunc = (action: ReportStateAction) => void;
type ReportActionEffect = (func: ReportActionEffectFunc) => void;

export const ReportContext = createContext<{
  dispatch: Dispatch<ReportStateAction>;
  useScrollTo: (listenForId: string) => Ref<HTMLDivElement>;
  useReportEffect: ReportActionEffect;
  useFocusedNode: (id: string, ignore?: boolean) => Ref<HTMLDivElement>;
}>({
  dispatch: () => null,
  useScrollTo: () => ({}) as Ref<HTMLDivElement>,
  useReportEffect: () => {},
  useFocusedNode: () => ({}) as Ref<HTMLDivElement>,
});

function Report({ reportData }: { reportData: schema.ReportDataObj }) {
  const [state, _dispatch] = useReportState(reportData.topics);
  const [dispatch, useReportEffect] = useReportSubscribe(_dispatch);
  const [useScrollTo] = useScrollListener(useReportEffect);
  const useFocusedNode = _useFocusedNode((id: string) =>
    dispatch({ type: "focus", payload: { id } }),
  );
  return (
    <ReportContext.Provider
      value={{ dispatch, useScrollTo, useReportEffect, useFocusedNode }}
    >
      <div className="mb-36">
        <ReportToolbar />
        <div className="fixed top-20 bottom-0 ml-2 hidden md:block">
          <Outline reportState={state} reportDispatch={dispatch} />
        </div>

        <Col gap={4} className="w-full md:w-1/2 max-w-[832px] m-auto">
          <ReportHeader reportData={reportData} />
          {state.children.map((themeNode) => (
            <Theme node={themeNode} />
          ))}
        </Col>
      </div>
    </ReportContext.Provider>
  );
}

export function ReportToolbar() {
  const { dispatch } = useContext(ReportContext);
  return (
    <Sticky
      className={cn(`z-50 w-full dark:bg-background bg-white`)}
      stickyClass="border-b shadow-sm"
    >
      <Row
        // ! make sure this is the same width as the theme cards.
        className={`p-2 justify-between md:w-1/2 max-w-[832px] mx-auto`}
      >
        <div></div>
        <Row gap={2}>
          <Button
            onClick={() => dispatch({ type: "closeAll", payload: { id: "" } })}
            variant={"outline"}
          >
            Collapse all
          </Button>
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
      <Row gap={2} className="justify-between">
        <h3>
          <a id={`${title}`}>{title}</a>
        </h3>
        <CopyLinkButton anchor={title} />
      </Row>

      <Row gap={4} className="h-5 flex-wrap gap-y-2">
        <Row gap={4} className="h-5">
          <TextIcon icon={<Icons.Theme size={16} className="self-center" />}>
            {nThemes} topics
          </TextIcon>
          <TextIcon icon={<Icons.Topic />}>{nTopics} subtopics</TextIcon>
          <TextIcon icon={<Icons.Claim />}>{nClaims} claims</TextIcon>
          <Separator orientation="vertical" />
        </Row>

        <Row gap={4} className="h-5">
          <TextIcon icon={<Icons.People size={16} className="self-center" />}>
            {nPeople} people
          </TextIcon>
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
        <ReportTitle
          title={reportData.title}
          nThemes={themes.length}
          nTopics={topics.length}
          nClaims={claims.length}
          nPeople={nPeople}
          dateStr={dateStr}
        />
        <p>{reportData.description}</p>
      </Col>
    </CardContent>
  );
}

export default Report;
