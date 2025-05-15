"use client";
import React, { useContext } from "react";
import { ReportContext } from "../report/Report";
import { SomeNode } from "../report/hooks/useReportState";

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
