import type { Meta, StoryObj } from "@storybook/react";
import Topic, {
  TopicClaims,
  TopicDescription,
  TopicHeader,
  TopicSummary,
} from "./Topic";
import { reportData } from "stories/data/dummyData";
import { Card, CardContent } from "../elements";

const meta = {
  title: "Topic",
  component: Topic,
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
} satisfies Meta<typeof Topic>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseProps = reportData.themes[0].topics[0];

export const Main: Story = {
  args: { topic: baseProps },
};

export const Header = () => (
  <TopicHeader
    title={baseProps.title}
    numClaims={baseProps.claims.length}
    numPeople={0}
  />
);

export const Description = () => (
  <TopicDescription description={baseProps.description!} />
);

export const Summary = () => <TopicSummary topic={baseProps} />;

export const Claims = () => <TopicClaims claims={baseProps.claims!} />;
