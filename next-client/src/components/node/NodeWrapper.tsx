"use client";
import type React from "react";
import { useContext } from "react";
import type { SomeNode } from "../report/hooks/useReportState";
import { ReportContext } from "../report/Report";

export function NodeWrapper({
  node,
  children,
  className,
}: React.PropsWithChildren<{ node: SomeNode; className?: string }>) {
  const { useScrollTo } = useContext(ReportContext);
  const scrollRef = useScrollTo(node.id);

  return (
    <div ref={scrollRef} className={className}>
      {children}
    </div>
  );
}
