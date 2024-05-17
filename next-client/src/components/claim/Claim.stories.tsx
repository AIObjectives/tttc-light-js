import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import Claim from "./Claim";

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

type Sizes = "lg" | "default" | "sm";
const sizes: Sizes[] = ["lg", "default", "sm"];

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
