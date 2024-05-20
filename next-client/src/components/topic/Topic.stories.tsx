import type { Meta, StoryObj } from "@storybook/react";
import Topic, { TopicClaims, TopicDescription, TopicHeader } from "./Topic";
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

const baseProps = taxonomyObject[0].subtopics[0];

export const Main: Story = {
  args: { subtopic: baseProps },
};

export const Header = () => (
  <TopicHeader
    title={baseProps.subtopicName}
    numClaims={baseProps.claimsCount!}
    numPeople={baseProps.claims!.length}
  />
);

export const Description = () => (
  <TopicDescription description={baseProps.subtopicShortDescription!} />
);

export const Claims = () => <TopicClaims claims={baseProps.claims!} />;
