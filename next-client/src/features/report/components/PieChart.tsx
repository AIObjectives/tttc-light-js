"use client";

import dynamic from "next/dynamic";
import React from "react";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });
import { PieChart as PieChartType } from "tttc-common/schema";

export default function PieChart({ pieData }: { pieData?: PieChartType }) {
  if (!pieData) return <></>;
  const { title, items } = pieData;
  const data = [
    {
      title,
      type: "pie",
      values: items.map((val) => val.count),
      labels: items.map((val) => val.label),
      textinfo: "label+percent",
      insidetextorientation: "radial",
    },
  ];
  return (
    <Plot
      // @ts-ignore
      data={data}
      layout={{ width: 500, height: 400, title }}
    />
  );
}
