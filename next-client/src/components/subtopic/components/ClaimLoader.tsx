"use client";

import { Button } from "@/components/elements";

function ClaimLoader({
  remaining,
  onExpandSubtopic,
}: {
  remaining: number;
  onExpandSubtopic: () => void;
}) {
  if (remaining <= 0) return <></>;
  return (
    <div className="pl-4 sm:pl-8">
      <Button
        variant={"outline"}
        onClick={onExpandSubtopic}
        data-testid={"show-more-claims-button"}
      >
        {remaining} more claim{remaining > 0 ? "s" : ""}
      </Button>
    </div>
  );
}

export default ClaimLoader;
