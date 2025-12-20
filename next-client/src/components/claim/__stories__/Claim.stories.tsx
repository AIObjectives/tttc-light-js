import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "../../../../stories/data/dummyData";
import { stateBuilder } from "../../report/hooks/useReportState/utils";
import { TopicContext } from "../../topic/Topic";
import { Claim, QuoteIcon as QuoteIconComponent } from "..";

const reportState = stateBuilder(reportData.topics);
const topicNode = reportState.children[0];

const meta = {
  title: "Claim",
  component: Claim,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <TopicContext.Provider
        value={{
          topicNode,
        }}
      >
        <div>
          <Story />
        </div>
      </TopicContext.Provider>
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
