import type { Meta, StoryObj } from "@storybook/react";
import YourReports, { ReportItem } from "./MyReports";

const meta = {
  title: "YourReports",
  component: YourReports,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof YourReports>;

export default meta;
type Story = StoryObj<typeof meta>;

const reports = [
  {
    reportDataUri: "",
    userId: "",
    numTopics: 1,
    numClaims: 4,
    numPeople: 2,
    numSubtopics: 3,
    description: "A very testy report",
    title: "test report",
    createdDate: new Date(),
  },
  {
    reportDataUri: "",
    userId: "",
    numTopics: 4,
    numClaims: 40,
    numPeople: 4,
    numSubtopics: 14,
    description:
      "Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset, accusamus laboramus id duo. Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans. Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans deterruisset, accusamus laboramus id duo. Lorem ipsum dolor sit amet, in eum erat constituam, ius ut justo reformidans.",
    title: "A lorem ipsum report",
    createdDate: new Date(),
  },
  {
    reportDataUri: "",
    userId: "",
    numTopics: 10,
    numClaims: 40,
    numPeople: 20,
    numSubtopics: 30,
    description: "Just another report",
    title: "Another report",
    createdDate: new Date(),
  },
];

export const Main: Story = {
  args: {
    reports,
  },
};

export const Single = () => <ReportItem {...reports[0]} />;
