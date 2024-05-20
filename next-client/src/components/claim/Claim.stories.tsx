import type { Meta, StoryObj } from "@storybook/react";
import Claim, { Quote, ClaimHeader, Quotes } from "./Claim";

const meta = {
  title: "Claim",
  component: Claim,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Claim>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    claimNum: 1,
    title:
      "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset",
    quotes: [
      "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum eratipsum dolor.",
      "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum dolor sit amet, in eum erat constituam.",
    ],
  },
};

export const Header = () => (
  <ClaimHeader
    claimNum={1}
    title="Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset"
  />
);

export const QuoteText = () => (
  <Quote quote="Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum eratipsum dolor." />
);

export const ManyQuotes = () => (
  <Quotes
    quotes={[
      "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum eratipsum dolor.",
      "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum dolor sit amet, in eum erat constituam.",
    ]}
  />
);
