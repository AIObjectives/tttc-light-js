import type React from "react";
import { forwardRef } from "react";

// import "../../app/global.css";

type DirectionProps = React.PropsWithChildren<{
  gap?: number;
}> &
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

const classDictRow = {
  0: "gap-x-0",
  0.5: "gap-x-0.5",
  1: "gap-x-1",
  1.5: "gap-x-1.5",
  2: "gap-x-2",
  2.5: "gap-x-2.5",
  3: "gap-x-3",
  3.5: "gap-x-3.5",
  4: "gap-x-4",
  5: "gap-x-5",
  6: "gap-x-6",
  7: "gap-x-7",
  8: "gap-x-8",
  9: "gap-x-9",
  10: "gap-x-10",
};

const classDictCol = {
  0: "gap-y-0",
  0.5: "gap-y-0.5",
  1: "gap-y-1",
  1.5: "gap-y-1.5",
  2: "gap-y-2",
  2.5: "gap-y-2.5",
  3: "gap-y-3",
  3.5: "gap-y-3.5",
  4: "gap-y-4",
  5: "gap-y-5",
  6: "gap-y-6",
  7: "gap-y-7",
  8: "gap-y-8",
  9: "gap-y-9",
  10: "gap-y-10",
};

const getRowGap = (n: number) => {
  if (n > 10) {
    throw new Error("Invalid row gap");
  } else {
    const s = n as keyof typeof classDictRow;
    return classDictRow[s];
  }
};

const getColGap = (n: number) => {
  if (n > 10) {
    throw new Error("Invalid col gap");
  } else {
    const s = n as keyof typeof classDictCol;
    return classDictCol[s];
  }
};

const Row = forwardRef<HTMLDivElement, DirectionProps>(function Row(
  { children, className, gap = 0, ...props }: DirectionProps,
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={`flex flex-row ${getRowGap(gap)} ${className}`}
    >
      {children}
    </div>
  );
});

const Col = forwardRef<HTMLDivElement, DirectionProps>(function Col(
  { children, className, gap = 0, ...props }: DirectionProps,
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={`flex flex-col ${getColGap(gap)} ${className}`}
    >
      {children}
    </div>
  );
});

export { Row, Col };
