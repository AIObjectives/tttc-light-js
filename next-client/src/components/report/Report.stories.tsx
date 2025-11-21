import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "../../../stories/data/dummyData";
import Report from "./Report";
import {
  ReportHeader,
  ReportOverview,
  ReportSummary,
  ReportTitle,
} from "./components/ReportHeader";
import { getNPeople } from "tttc-common/morphisms";
import * as schema from "tttc-common/schema";
import jsonData from "../../../stories/data/healMichigan.json";

const meta = {
  title: "Report",
  component: Report,
  parameters: {
    // layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Report>;

export default meta;
type Story = StoryObj<typeof meta>;

// Limit data for Storybook to avoid 30-second timeout with massive hidden DOM.
// Report component is more complex than Topic, needs even smaller dataset.
// Large report testing is done manually outside CI - see test-csv-examples/
const limitedReportData = {
  ...reportData,
  topics: reportData.topics.slice(0, 1).map((topic) => ({
    ...topic,
    subtopics: topic.subtopics.slice(0, 1).map((subtopic) => ({
      ...subtopic,
      claims: subtopic.claims.slice(0, 2),
    })),
  })),
};

const baseProps = limitedReportData;

// Parse the raw pipeline output for the Report component
const parsedPipeline = schema.pipelineOutput.safeParse(jsonData);
const rawPipelineOutput: schema.PipelineOutput = parsedPipeline.success
  ? parsedPipeline.data
  : {
      success: true,
      data: [{ step: "csv" as const }, baseProps],
    };

export const Main: Story = {
  args: {
    reportData: baseProps,
    reportUri: "",
    rawPipelineOutput,
  },
};

export const Header = () => <ReportHeader {...baseProps} />;

export const Title = () => (
  <ReportTitle
    title={"Test"}
    nClaims={
      baseProps.topics.flatMap((theme) =>
        theme.subtopics.flatMap((topic) => topic.claims),
      ).length
    }
    nPeople={getNPeople(baseProps.topics)}
    nThemes={baseProps.topics.length}
    nTopics={baseProps.topics.flatMap((theme) => theme.subtopics).length}
    dateStr={baseProps.date}
  />
);

export const Summary = () => <ReportSummary {...baseProps} />;

export const Overview = () => <ReportOverview topics={baseProps.topics} />;
