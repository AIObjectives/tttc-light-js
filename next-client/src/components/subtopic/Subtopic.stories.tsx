import React, { Ref } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import Subtopic from "./Subtopic";
import { reportData } from "../../../stories/data/dummyData";
import { stateBuilder } from "../report/hooks/useReportState/utils";
import { ReportContext } from "../report/Report";
import { TopicContext } from "../topic/Topic";

const reportState = stateBuilder(reportData.topics);
const topicNode = reportState.children[0];
const subtopicNode = topicNode.children[0];

const meta = {
  title: "Subtopic",
  component: Subtopic,
  parameters: {},
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ReportContext.Provider
        value={{
          dispatch: () => null,
          useScrollTo: () => ({}) as Ref<HTMLDivElement>,
          setScrollTo: () => null,
          useReportEffect: () => {},
          useFocusedNode: () => ({}) as Ref<HTMLDivElement>,
        }}
      >
        <TopicContext.Provider
          value={{
            topicNode,
          }}
        >
          <div className="border">
            <Story />{" "}
          </div>
        </TopicContext.Provider>
      </ReportContext.Provider>
    ),
  ],
} satisfies Meta<typeof Subtopic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  args: { subtopicNode: subtopicNode, onExpandSubtopic: () => null },
};
