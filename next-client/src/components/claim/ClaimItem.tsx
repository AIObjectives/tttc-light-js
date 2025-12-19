"use client";
import type React from "react";
import { useContext } from "react";
import { ReportContext } from "../report/Report";

export function ClaimItem({
  show,
  id,
  children,
}: React.PropsWithChildren<{ id: string; show: boolean }>) {
  const { useScrollTo } = useContext(ReportContext);
  const scrollRef = useScrollTo(id);

  if (!show) return <></>;
  return <div ref={scrollRef}>{children}</div>;
}
