import type { Meta, StoryObj } from "@storybook/react";
import Claim, { Quote, ClaimHeader, Quotes } from "./Claim";
import { reportData } from "stories/data/dummyData";

const meta = {
  title: "Claim",
  component: Claim,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Claim>;

const baseProps = reportData.topics[0].subtopics[0].claims[0];

export default meta;
type Story = StoryObj<typeof meta>;

// export const Primary: Story = {
//   args: {
//     claimNum: 1,
//     title:
//       "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset",
//     quotes: baseProps.quotes,
//   },
// };
export const Primary: Story = {
  args: {
    claimNode: {
      data: {
        title:
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset",
        quotes: baseProps.quotes,
        similarClaims: [],
        id: "",
        number: 0,
      },
    },
    claimNum: 0,
    show: true,
  },
};

export const Header = () => (
  <ClaimHeader claimNum={1} title={baseProps.title} />
);

export const QuoteText = () => <Quote quote={baseProps.quotes[0]} />;

export const ManyQuotes = () => <Quotes quotes={baseProps.quotes} />;
