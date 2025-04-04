import type { Meta, StoryObj } from "@storybook/react";
import Subtopic, {
  SubtopicComponent,
  SubtopicClaims,
  SubtopicDescription,
  SubtopicHeader,
  SubtopicSummary,
} from "./Subtopic";
import { reportData } from "stories/data/dummyData";
import { Card, CardContent } from "../elements";
import { CopyLinkButton } from "../copyButton/CopyButton";
import { getNPeople } from "tttc-common/morphisms/index";
import { __internals } from "../report/hooks/useReportState";

const { stateBuilder } = __internals;

const reportState = stateBuilder(reportData.topics);
const subtopicNode = reportState.children[0].children[0];

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

// const baseProps = subtopicNode.data;

export const Main: Story = {
  args: { node: subtopicNode, isOpen: true },
};

// export const Header = () => (
//   <SubtopicHeader
//     title={subtopicNode.data.title}
//     numClaims={subtopicNode.data.claims.length}
//     numPeople={getNPeople(subtopicNode.data.claims)}
//     button={<CopyLinkButton anchor={subtopicNode.data.title} />}
//   />
// );

// export const Description = () => (
//   <SubtopicDescription description={subtopicNode.data.description!} />
// );

// export const Summary = () => <SubtopicSummary subtopic={subtopicNode.data} />;

// export const Claims = () => <SubtopicClaims subtopicNode={subtopicNode} />;
