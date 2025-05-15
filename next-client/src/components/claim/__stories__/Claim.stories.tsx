import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Claim, QuoteIcon as QuoteIconComponent } from "..";
import { reportData } from "../../../../stories/data/dummyData";

const meta = {
  title: "Claim",
  component: Claim,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div>
        <Story />
      </div>
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
