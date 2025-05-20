"use client";
import CreateReport from "@/components/create/CreateReport";
import { useUser } from "@/lib/hooks/getUser";
import React from "react";

export default function ReportCreationPage() {
  const user = useUser();

  if (user === null) {
    return (
      <div className="w-full h-full content-center justify-items-center">
        <p>Please login to create a report</p>
      </div>
    );
  }

  return (
    <div className="m-auto max-w-[832px] p-2 mt-4">
      <CreateReport />
    </div>
  );
}
