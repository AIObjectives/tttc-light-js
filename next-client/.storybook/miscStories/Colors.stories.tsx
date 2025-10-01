import {
  getThemeColor,
  ThemeColor,
  themeColorMap,
  ColorVariant,
  BackgroundClass,
  BackgroundAccentClass,
  BorderClass,
  BorderAccentClass,
  TextClass,
  BackgroundAccentHoverClass,
  TextHoverClass,
  BackgroundHoverClass,
  TextAccentClass,
  FillClass,
  FillAccentClass,
} from "../../src/lib/color";
import { Col, Row } from "../../src/components/layout/Directions";
import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Separator } from "storybook/internal/components";

const colorVariants = Object.keys(
  themeColorMap["blueSea"],
) as Array<ColorVariant>;

type Annotation = { annotation: string };

const Annotate = ({
  annotation,
  children,
}: React.PropsWithChildren<Annotation>) => (
  <Col className="h-25 justify-between p-3 border-r content-center">
    <p>{annotation}</p>
    <Separator />
    <div className="w-full flex justify-center">{children}</div>
  </Col>
);

const BackgroundSquare = ({
  backgroundColor,
  annotation,
}: {
  backgroundColor: BackgroundClass | BackgroundAccentClass;
} & Annotation) => {
  return (
    <Annotate annotation={annotation}>
      <div className={`aspect-square h-10 ${backgroundColor}`} />
    </Annotate>
  );
};

const BorderSquare = ({
  borderColor,
  annotation,
}: { borderColor: BorderClass | BorderAccentClass } & Annotation) => (
  <Annotate annotation={annotation}>
    <div className={`aspect-square h-10 bg-black border-8 ${borderColor}`} />
  </Annotate>
);

const BackgroundHoverSquare = ({
  backgroundHover,
  annotation,
}: {
  backgroundHover: BackgroundHoverClass | BackgroundAccentHoverClass;
} & Annotation) => (
  <Annotate annotation={annotation}>
    <div className={`aspect-square h-10 bg-black ${backgroundHover}`} />
  </Annotate>
);

const Text = ({
  textColor,
  annotation,
}: {
  textColor: TextClass | TextAccentClass | TextHoverClass;
} & Annotation) => (
  <Annotate annotation={annotation}>
    <div>
      <p className={`font-bold text-lg ${textColor}`}>Example Text</p>
    </div>
  </Annotate>
);

const Fill = ({
  fillColor,
  annotation,
}: { fillColor: FillClass | FillAccentClass } & Annotation) => (
  <Annotate annotation={annotation}>
    <svg
      className={`w-16 h-16 ${fillColor}`}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
    </svg>
  </Annotate>
);

const ColorPalette = <Color extends ThemeColor>({
  color,
}: {
  color: Color;
}) => (
  <Row gap={2}>
    {colorVariants.map((variant) => {
      switch (variant) {
        case "bg":
          return (
            <BackgroundSquare
              backgroundColor={getThemeColor(color, variant)}
              annotation={"bg"}
            />
          );
        case "bgAccent":
          return (
            <BackgroundSquare
              backgroundColor={getThemeColor(color, variant)}
              annotation={"bg-accent"}
            />
          );

        case "border":
          return (
            <BorderSquare
              borderColor={getThemeColor(color, variant)}
              annotation="border"
            />
          );
        case "borderAccent":
          return (
            <BorderSquare
              borderColor={getThemeColor(color, variant)}
              annotation="border-accent"
            />
          );
        case "bgHover":
          return (
            <BackgroundHoverSquare
              backgroundHover={getThemeColor(color, variant)}
              annotation="bg-hover"
            />
          );
        case "bgAccentHover":
          return (
            <BackgroundHoverSquare
              backgroundHover={getThemeColor(color, variant)}
              annotation="bg-accent-hover"
            />
          );
        case "text":
          return (
            <Text textColor={getThemeColor(color, variant)} annotation="text" />
          );
        case "textAccent":
          return (
            <Text
              textColor={getThemeColor(color, variant)}
              annotation="text-accent"
            />
          );
        case "textHover":
          return (
            <Text
              textColor={getThemeColor(color, variant)}
              annotation="text-hover"
            />
          );
        case "fill":
          return (
            <Fill fillColor={getThemeColor(color, variant)} annotation="fill" />
          );
        case "fillAccent":
          return (
            <Fill
              fillColor={getThemeColor(color, variant)}
              annotation="fill-accent"
            />
          );
      }
    })}
  </Row>
);

const meta = {
  title: "Color",
  component: ColorPalette,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ColorPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Violet: Story = {
  args: {
    color: "violet",
  },
};

export const BlueSea: Story = {
  args: {
    color: "blueSea",
  },
};

export const BlueSky: Story = {
  args: {
    color: "blueSky",
  },
};

export const GreenLeaf: Story = {
  args: {
    color: "greenLeaf",
  },
};

export const GreenLime: Story = {
  args: {
    color: "greenLime",
  },
};

export const Yellow: Story = {
  args: {
    color: "yellow",
  },
};

export const Red: Story = {
  args: {
    color: "red",
  },
};

export const Brown: Story = {
  args: {
    color: "brown",
  },
};
