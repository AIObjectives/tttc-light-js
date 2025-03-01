"use client";

import { Button } from "@src/components/elements";
import { SubtopicNode } from "@src/components/report/hooks/useReportState";
import { ReportContext } from "@src/components/report/Report";
import { useContext } from "react";

function ClaimLoader({ subtopicNode }: { subtopicNode: SubtopicNode }) {
  const { dispatch } = useContext(ReportContext);
  const remaining = subtopicNode.children.length - subtopicNode.pagination - 1;
  if (!remaining) return <></>;
  return (
    <div className="pl-4 sm:pl-8">
      <Button
        variant={"outline"}
        onClick={() =>
          dispatch({
            type: "expandSubtopic",
            payload: { id: subtopicNode.data.id },
          })
        }
      >
        {remaining} more claim{remaining > 0 ? "s" : ""}
      </Button>
    </div>
  );
}

export default ClaimLoader;
