"use client";

import React, { Dispatch, Ref, SetStateAction, createContext } from "react";
import * as schema from "tttc-common/schema";
import { Col } from "../layout";
import { ReportStateAction } from "./hooks/useReportState";
import Outline from "../outline/Outline";
import Topic from "../topic/Topic";
import { useFocusedNode as _useFocusedNode } from "./hooks/useFocusedNode";
import { toast } from "sonner";
import { downloadReportData } from "@/lib/report/downloadUtils";
import { useReport } from "./hooks/useReport";
import { ReportLayout } from "./components/ReportLayout";
import { ReportHeader } from "./components/ReportHeader";
import { ReportToolbar } from "./components/ReportToolbar";
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
  rawPipelineOutput,
}: {
  reportData: schema.UIReportData;
  rawPipelineOutput: schema.PipelineOutput;
}) {
  const {
    state,
    dispatch,
    useScrollTo,
    setScrollTo,
    useReportEffect,
    useFocusedNode,
    isMobileOutlineOpen,
    setIsMobileOutlineOpen,
    navbarState,
    outlineState,
    outlineDispatch,
  } = useReport(reportData);

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
              {state.children.map((topicNode) => (
                <Topic key={topicNode.data.id} node={topicNode} />
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
