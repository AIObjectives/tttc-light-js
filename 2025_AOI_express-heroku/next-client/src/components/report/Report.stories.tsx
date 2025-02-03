import type { Meta, StoryObj } from "@storybook/react";
import { reportData } from "stories/data/dummyData";
import Report, {
  ReportHeader,
  ReportOverview,
  ReportSummary,
  ReportTitle,
} from "./Report";
import { getNPeople } from "tttc-common/morphisms/index";

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

export const Header = () => <ReportHeader reportData={baseProps} />;

export const Title = () => (
  <ReportTitle
    title={"Test"}
    nClaims={
      baseProps.topics.flatMap((theme) =>
        theme.subtopics.flatMap((topic) => topic.claims),
      ).length
    }
    nPeople={getNPeople(baseProps.topics)}
    nThemes={baseProps.topics.length}
    nTopics={baseProps.topics.flatMap((theme) => theme.subtopics).length}
    dateStr={baseProps.date}
  />
);

export const Summary = () => <ReportSummary reportData={baseProps} />;

export const Overview = () => <ReportOverview topics={baseProps.topics} />;

export const Toolbar = () => <></>;
