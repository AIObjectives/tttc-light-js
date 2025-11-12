import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "../../../stories/data/dummyData";
import Report from "./Report";
import { ReportTitle } from "./components/ReportHeader";
import { ReportHeader } from "./components/ReportHeader";
import { ReportSummary } from "./components/ReportHeader";
import { getNPeople } from "tttc-common/morphisms";
import * as schema from "tttc-common/schema";

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

const baseProps: schema.UIReportData = reportData;

export const Main: Story = {
  // @ts-ignore
  args: {
    reportData: baseProps,
  },
};

export const Header = () => <ReportHeader {...baseProps} />;

export const Title = () => (
  // ! I can't figure out what's causing the type errors here, but they don't cause any failures
  // ! Seems like the transform on the zod parser is making flatMap not available?
  <ReportTitle
    title={"Test"}
    nClaims={
      // @ts-ignore
      baseProps.topics.flatMap((theme) =>
        // @ts-ignore
        theme.subtopics.flatMap((topic) => topic.claims),
      ).length
    }
    nPeople={getNPeople(baseProps.topics)}
    nTopics={baseProps.topics.length}
    // @ts-ignore
    nSubtopics={baseProps.topics.flatMap((theme) => theme.subtopics).length}
    dateStr={baseProps.date}
  />
);

export const Summary = () => <ReportSummary {...baseProps} />;
