import React from "react";

type ClassNameType = React.ComponentProps<"div">["className"];
type DirectionPropType = React.PropsWithChildren<{
  className?: ClassNameType;
  gap: number;
}>;

const constructClassName = (
  direction: "row" | "col",
  gap: number,
  className?: string,
) =>
  `flex flex-${direction} gap-${direction === "col" ? "y" : "x"}-${gap} ` +
  className;

function Direction(direction: "row" | "col") {
  return ({ children, gap, className }: DirectionPropType) => {
    if (className?.includes("gap"))
      throw new Error(
        "Don't include gap in classname for Row, use prop instead",
      );

    return (
      <div className={constructClassName(direction, gap, className)}>
        {children}
      </div>
    );
  };
}

export const Row = Direction("row");

export const Col = Direction("col");
