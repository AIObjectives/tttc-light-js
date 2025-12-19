"use client";

import { Button } from "@/components/elements";
import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";

function ClaimLoader({
  remaining,
  onExpandSubtopic,
}: {
  remaining: number;
  onExpandSubtopic: () => void;
}) {
  const hoverBackground = useThemeContextColor("bgAccentHover");
  if (remaining <= 0) return null;
  return (
    <div className="pl-4 sm:pl-8">
      <Button
        variant={"outline"}
        onClick={onExpandSubtopic}
        data-testid={"show-more-claims-button"}
        className={`${hoverBackground}`}
      >
        {remaining} more claim{remaining > 0 ? "s" : ""}
      </Button>
    </div>
  );
}

export default ClaimLoader;
