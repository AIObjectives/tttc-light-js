"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { Col, Row } from "../layout";
import Icons from "@src/assets/icons";

export type BarChartItemType = {
  title: string;
  percentFill: number;
  subtitle: string;
};

export function BarChart({ entries }: { entries: BarChartItemType[] }) {
  return (
    <Col>
      {entries.map((entry) => (
        <BarItem entry={entry} />
      ))}
    </Col>
  );
}

export function BarItem({ entry }: { entry: BarChartItemType }) {
  return (
    <Col gap={2} className="py-2 group relative">
      <div className="w-[calc(100%+20px)] top-0 h-full group-hover:left-[-10px] group-hover:right-[calc(100%+10px)] hidden group-hover:block group-hover:absolute group-hover:bg-muted group-hover:rounded-md group-hover:mix-blend-multiply" />
      <Bar percent={entry.percentFill} />
      <Label title={entry.title} subtitle={entry.subtitle} />
    </Col>
  );
}

function Label({ title, subtitle }: Omit<BarChartItemType, "percentFill">) {
  return (
    <Row gap={2}>
      <p className="p2">{title}</p>
      <p className="p2 text-muted-foreground">{subtitle}</p>
      <div className="h-4 w-4 self-center">
        <Icons.ChevronRight className="stroke-black w-full h-full" />
      </div>
    </Row>
  );
}

export function Bar({ percent }: { percent: number }) {
  if (percent > 1 || percent < 0)
    throw new Error("Barchart should only accept values between 0 and 1");
  const divRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState<number>(0);

  useLayoutEffect(() => {
    setWidth((divRef.current?.offsetWidth || 0) * percent);
  }, [divRef.current?.offsetWidth]);

  return (
    <Row ref={divRef} className="flex-grow bg-secondary items-center">
      <div className="bg-primary h-[2px]" style={{ width: width }} />
      <div className="bg-gray-300 h-[2px] flex-grow" />
    </Row>
  );
}
