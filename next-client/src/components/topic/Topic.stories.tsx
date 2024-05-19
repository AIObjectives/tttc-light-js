import type { Meta, StoryObj } from "@storybook/react";
import Topic from "./Topic";
import { taxonomyObject } from "stories/data/dummyData";
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
      <Card>
        <CardContent>
          <Story />
        </CardContent>
      </Card>
    ),
  ],
} satisfies Meta<typeof Topic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { subtopic: taxonomyObject[0].subtopics[0] },
};
