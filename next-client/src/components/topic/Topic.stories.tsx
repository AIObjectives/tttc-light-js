import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { useReportStore } from "@/stores/reportStore";
import { buildTopicNodes } from "@/stores/testUtils";
import { reportData } from "../../../stories/data/dummyData";
import { ReportDataContext } from "../report/Report";
import Topic from "./Topic";

// Limit data for Storybook to avoid 30-second timeout with massive hidden DOM.
// Large report testing is done manually outside CI - see test-csv-examples/
const limitedTopics = reportData.topics.map((topic) => ({
  ...topic,
  subtopics: topic.subtopics.slice(0, 2).map((subtopic) => ({
    ...subtopic,
    claims: subtopic.claims.slice(0, 3),
  })),
}));

const topicNodes = buildTopicNodes(limitedTopics);
const themeNode = topicNodes[0];

// Decorator to initialize Zustand store and provide context
function StoryWrapper({ children }: { children: React.ReactNode }) {
  const initialize = useReportStore((s) => s.initialize);
  const reset = useReportStore((s) => s.reset);

  useEffect(() => {
    initialize(limitedTopics);
    return () => reset();
  }, [initialize, reset]);

  return (
    <ReportDataContext.Provider
      value={{
        addOns: reportData.addons,
        getTopicColor: () => undefined,
        getSubtopicId: () => null,
      }}
    >
      {children}
    </ReportDataContext.Provider>
  );
}

const meta = {
  title: "Topic",
  component: Topic,
  parameters: {},
  decorators: [
    (Story) => (
      <StoryWrapper>
        <Story />
      </StoryWrapper>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof Topic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  args: {
    node: themeNode,
  },
};
