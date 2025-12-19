import type { Meta, StoryObj } from "@storybook/react";
import type { Ref } from "react";
import { reportData } from "../../../stories/data/dummyData";
import { stateBuilder } from "../report/hooks/useReportState/utils";
import { ReportContext } from "../report/Report";
import { TopicContext } from "../topic/Topic";
import Subtopic from "./Subtopic";

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
          useFocusedNodeForCruxes: () => ({}) as Ref<HTMLDivElement>,
          addOns: reportData.addons,
          sortByControversy: false,
          setSortByControversy: () => null,
          expandedCruxId: null,
          setExpandedCruxId: () => null,
          activeContentTab: "report",
          setActiveContentTab: () => null,
          getTopicColor: () => undefined,
          getSubtopicId: () => null,
          focusedCruxId: null,
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
  args: {
    subtopicNode: subtopicNode,
    topicTitle: topicNode.data.title,
    topicColor: topicNode.data.topicColor,
    show: true,
  },
};
