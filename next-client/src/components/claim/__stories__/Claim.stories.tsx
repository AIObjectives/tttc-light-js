import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { useReportStore } from "@/stores/reportStore";
import { buildTopicNodes } from "@/stores/testUtils";
import { reportData } from "../../../../stories/data/dummyData";
import { ReportDataContext } from "../../report/Report";
import { TopicContext } from "../../topic/Topic";
import { Claim, QuoteIcon as QuoteIconComponent } from "..";

const topicNodes = buildTopicNodes(reportData.topics);
const topicNode = topicNodes[0];

// Decorator to initialize Zustand store and provide context
function StoryWrapper({ children }: { children: React.ReactNode }) {
  const initialize = useReportStore((s) => s.initialize);
  const reset = useReportStore((s) => s.reset);

  useEffect(() => {
    initialize(reportData.topics);
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
      <TopicContext.Provider value={{ topicNode }}>
        <div>{children}</div>
      </TopicContext.Provider>
    </ReportDataContext.Provider>
  );
}

const meta = {
  title: "Claim",
  component: Claim,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <StoryWrapper>
        <Story />
      </StoryWrapper>
    ),
  ],
} satisfies Meta<typeof Claim>;

const baseProps = reportData.topics[0].subtopics[0].claims[0];

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    claim: {
      title:
        "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset",
      quotes: baseProps.quotes,
      similarClaims: [],
      id: "",
      number: 0,
    },
  },
};

export const QuoteIcon = () => <QuoteIconComponent num={3} />;
