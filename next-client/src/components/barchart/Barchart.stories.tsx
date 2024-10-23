import type { Meta, StoryObj } from "@storybook/react";
import { BarChart, BarItem as BarItemComponent } from "./Barchart";
import { reportData } from "stories/data/dummyData";
import { getNClaims } from "tttc-common/morphisms";

const meta = {
  title: "BarChart",
  component: BarChart,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const topic = reportData.topics[1];

export const Primary: Story = {
  args: {
    entries: [
      {
        title: topic.title,
        percentFill: 0.7,
        subtitle: `${getNClaims(topic.subtopics)} claims`,
      },
    ],
  },
};

export const BarItem = () => (
  <BarItemComponent
    entry={{
      title: topic.title,
      percentFill: 0.7,
      subtitle: `${getNClaims(topic.subtopics)} claims`,
    }}
  />
);
