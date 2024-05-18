import type { Meta, StoryObj } from "@storybook/react";
import Theme from "./Theme";
import { taxonomyObject } from "stories/data/dummyData";
const meta = {
  title: "Theme",
  component: Theme,
  parameters: {
    // layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Theme>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: taxonomyObject[0],
};
