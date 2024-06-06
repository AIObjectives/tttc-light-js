import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "stories/data/dummyData";
import Report, { ReportHeader, ReportTitle } from "./Report";

const meta = {
  title: "Report",
  component: Report,
  parameters: {
    // layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Report>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseProps = reportData;

export const Main: Story = {
  args: { reportData: baseProps },
};

export const Summary = () => <ReportHeader reportData={baseProps} />;

export const Header = () => (
  <ReportTitle
    title={"Test"}
    nClaims={100}
    nPeople={20}
    nThemes={3}
    nTopics={20}
    dateStr={`January 9, 2020`}
  />
);

export const Toolbar = () => <></>;
