import type { Meta, StoryObj } from "@storybook/react";
import Topic, {
  TopicClaims,
  TopicDescription,
  TopicHeader,
  TopicSummary,
} from "./Topic";
import { reportData } from "stories/data/dummyData";
import { Card, CardContent } from "../elements";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { getNPeople } from "tttc-common/morphisms/index";
import { __internals } from "../report/hooks/useReportState";

const { stateBuilder } = __internals;

const reportState = stateBuilder(reportData.themes);
const topicNode = reportState.children[0].children[0];

const meta = {
  title: "Topic",
  component: Topic,
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
} satisfies Meta<typeof Topic>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseProps = topicNode.data;

export const Main: Story = {
  args: { node: topicNode, isOpen: true },
};

export const Header = () => (
  <TopicHeader
    title={topicNode.data.title}
    numClaims={topicNode.data.claims.length}
    numPeople={getNPeople(topicNode.data.claims)}
    button={<CopyLinkButton anchor={topicNode.data.title} />}
  />
);

export const Description = () => (
  <TopicDescription description={topicNode.data.description!} />
);

export const Summary = () => <TopicSummary topic={topicNode.data} />;

export const Claims = () => <TopicClaims claims={topicNode.data.claims!} />;
