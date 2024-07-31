import type { Meta, StoryObj } from "@storybook/react";
import Subtopic, {
  SubtopicClaims,
  SubtopicDescription,
  SubtopicHeader,
  SubtopicSummary,
} from "./Subtopic";
import { reportData } from "stories/data/dummyData";
import { Card, CardContent } from "../elements";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { getNPeople } from "tttc-common/morphisms/index";
import { __internals } from "../report/hooks/useReportState";

const { stateBuilder } = __internals;

const reportState = stateBuilder(reportData.topics);
const topicNode = reportState.children[0].children[0];

const meta = {
  title: "Subtopic",
  component: Subtopic,
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
} satisfies Meta<typeof Subtopic>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseProps = topicNode.data;

export const Main: Story = {
  args: { node: topicNode, isOpen: true },
};

export const Header = () => (
  <SubtopicHeader
    title={topicNode.data.title}
    numClaims={topicNode.data.claims.length}
    numPeople={getNPeople(topicNode.data.claims)}
    button={<CopyLinkButton anchor={topicNode.data.title} />}
  />
);

export const Description = () => (
  <SubtopicDescription description={topicNode.data.description!} />
);

export const Summary = () => <SubtopicSummary topic={topicNode.data} />;

export const Claims = () => <SubtopicClaims claims={topicNode.data.claims!} />;
