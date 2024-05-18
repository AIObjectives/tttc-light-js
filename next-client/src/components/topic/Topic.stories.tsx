import type { Meta, StoryObj } from "@storybook/react";
import Topic from "./Topic";

const meta = {
  title: "Topic",
  component: Topic,
  parameters: {
    // layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Topic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    title: "Lorem ipsum",
    description:
      "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset, accusamus laboramus id duo. Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans",
    claims: [
      {
        title:
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset",
        quotes: [
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum eratipsum dolor.",
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum dolor sit amet, in eum erat constituam.",
        ],
      },
      {
        title:
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset",
        quotes: [
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum eratipsum dolor.",
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum dolor sit amet, in eum erat constituam.",
        ],
      },
      {
        title:
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset",
        quotes: [
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum eratipsum dolor.",
          "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset dolor sit ipsum dolor sit amet, in eum dolor sit amet, in eum erat constituam.",
        ],
      },
    ],
  },
};
