import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "../../../stories/data/dummyData";
import Outline from "./Outline";
import { __internals } from "./hooks/useOutlineState";
import { stateBuilder } from "../report/hooks/useReportState/utils";
import { createInitialState } from "./hooks/useOutlineState/utils";
import { ReportContext } from "../report/Report";
import React from "react";

const meta = {
  title: "Outline",
  component: Outline,
  parameters: {
    layout: "center",
  },
  decorators: (Story) => (
    <ReportContext.Provider
      value={{
        setScrollTo: () => ({}),
        dispatch: () => ({}),
        useFocusedNode() {
          return {} as React.Ref<HTMLDivElement>;
        },
        useReportEffect() {},
        useScrollTo() {
          return {} as React.Ref<HTMLDivElement>;
        },
        addOns: reportData.addons,
        sortByControversy: false,
        setSortByControversy: () => null,
        expandedCruxId: null,
        setExpandedCruxId: () => null,
        activeContentTab: "report",
        setActiveContentTab: () => null,
        getTopicColor: () => undefined,
      }}
    >
      <Story />
    </ReportContext.Provider>
  ),
  tags: ["autodocs"],
} satisfies Meta<typeof Outline>;

// Limit data for Storybook to avoid 30-second timeout with massive hidden DOM.
// Large report testing is done manually outside CI - see test-csv-examples/
const limitedTopics = reportData.topics.map((topic) => ({
  ...topic,
  subtopics: topic.subtopics.slice(0, 2).map((subtopic) => ({
    ...subtopic,
    claims: subtopic.claims.slice(0, 3),
  })),
}));

const reportState = stateBuilder(limitedTopics);
const outlineState = createInitialState(reportState);
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    outlineState,
    reportDispatch: () => {},
    outlineDispatch: () => {},
  },
};
