"use client";

import type * as schema from "tttc-common/schema";
import Icons from "@/assets/icons";
import { getThemeColor } from "@/lib/color";
import { useReportUIStore } from "@/stores/reportUIStore";
import { useReportStore } from "@/stores/reportStore";
import { Col, Row } from "../layout";

export type BarChartItemType = {
  id: string;
  title: string;
  percentFill: number;
  subtitle: string;
  color: schema.Topic["topicColor"];
};

export function BarChart({ entries }: { entries: BarChartItemType[] }) {
  const scrollTo = useReportUIStore((s) => s.scrollTo);
  const setActiveContentTab = useReportUIStore((s) => s.setActiveContentTab);
  const openNode = useReportStore((s) => s.openNode);
  return (
    <Col>
      {entries.map((entry) => (
        <BarItem
          entry={entry}
          key={entry.title}
          onClick={() => {
            // Switch to report tab first (in case we're on cruxes tab)
            setActiveContentTab("report");
            // Open/expand the topic so it's visible
            openNode(entry.id);
            // Then scroll to the topic
            scrollTo(entry.id);
          }}
        />
      ))}
    </Col>
  );
}

export function BarItem({
  entry,
  onClick,
}: {
  entry: BarChartItemType;
  onClick: () => void;
}) {
  const hoverColor = getThemeColor(entry.color, "groupHoverBgAccent");

  return (
    <Col gap={2} className="py-2 group relative" onClick={onClick}>
      <div
        className={`w-[calc(100%+20px)] top-0 h-full group-hover:left-[-10px] group-hover:right-[calc(100%+10px)] hidden group-hover:block group-hover:absolute ${hoverColor} group-hover:rounded-md group-hover:mix-blend-multiply`}
      />
      <Bar percent={entry.percentFill} color={entry.color} />
      <Label title={entry.title} subtitle={entry.subtitle} />
    </Col>
  );
}

function Label({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Row gap={2}>
      <p className="p2">{title}</p>
      <p className="p2 text-muted-foreground">{subtitle}</p>
      <div className="h-4 w-4 self-center">
        <Icons.ChevronRight16 className="stroke-black w-full h-full" />
      </div>
    </Row>
  );
}

export function Bar({
  percent,
  color,
}: {
  percent: number;
  color: schema.Topic["topicColor"];
}) {
  if (percent > 1 || percent < 0)
    throw new Error("Barchart should only accept values between 0 and 1");

  const fillColor = getThemeColor(color, "bg");

  return (
    <Row className="flex-grow bg-secondary items-center">
      <div
        className={`${fillColor} h-[2px]`}
        style={{ width: `${percent * 100}%` }}
      />
      <div className="bg-gray-300 h-[2px] flex-grow" />
    </Row>
  );
}
