import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { reportData } from "../../../stories/data/dummyData";
import { Button } from "../elements";
import { Col, Row } from "../layout";
import PointGraphic, {
  Cell as CellComponent,
  PointGraphicGroup,
} from "./PointGraphic";

/**
 * ! This story will be broken until it's properly refactored
 */

const meta = {
  title: "PointGraphic",
  component: PointGraphic,
  parameters: {
    layout: "center",
  },
  tags: ["autodocs"],
  decorators: [
    (_Story) => (
      <div className="flex h-screen border items-center justify-center">
        {/* <Story /> */}
      </div>
    ),
  ],
} satisfies Meta<typeof PointGraphic>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseProps = reportData.topics[0].subtopics;

export const Main: Story = {
  args: {
    claims: baseProps.flatMap((subtopic) => subtopic.claims),
  },
};

export function PointGraphicGroupInteraction() {
  const [isHighlighted, setIsHighlighted] = useState(false);

  return (
    <Col gap={5}>
      <Row className="gap-x-[3px]">
        <PointGraphicGroup
          claims={baseProps[0].claims}
          isHighlighted={isHighlighted}
        />
        <PointGraphicGroup
          claims={baseProps[0].claims}
          isHighlighted={isHighlighted}
        />
      </Row>
      <Button onClick={() => setIsHighlighted((curr) => !curr)}>
        Press Me
      </Button>
    </Col>
  );
}

export const Cell = () => <CellComponent claim={baseProps[0].claims[0]} />;
