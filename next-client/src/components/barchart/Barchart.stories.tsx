import type { Meta, StoryObj } from "@storybook/react";
import * as schema from "tttc-common/schema";
import { getNClaims } from "tttc-common/transforms";
import { reportData } from "../../../stories/data/dummyData";
import {
  BarChart,
  type BarChartItemType,
  BarItem as BarItemComponent,
} from "./Barchart";

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

const entries: BarChartItemType[] = schema.topicColors.options.map((color) => ({
  id: "",
  title: "Some topic",
  percentFill: 0.7,
  subtitle: "# Claims",
  color,
}));

export const Primary: Story = {
  args: {
    entries,
  },
};

export const BarItem = () => (
  <BarItemComponent
    entry={{
      id: "",
      title: topic.title,
      percentFill: 0.7,
      subtitle: `${getNClaims(topic.subtopics)} claims`,
      color: "blueSea",
    }}
    onClick={() => null}
  />
);
