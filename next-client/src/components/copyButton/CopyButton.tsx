"use client";

import { toast } from "sonner";
import Icons from "@/assets/icons";
import type { ColorVariant } from "@/lib/color";
import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";
import { Button } from "../elements";

const safeUseColor = (color: ColorVariant) => {
  try {
    // biome-ignore lint/correctness/useHookAtTopLevel: intentional try-catch for graceful fallback when context unavailable
    return useThemeContextColor(color);
  } catch {
    return undefined;
  }
};

// T3C-822: Use muted gray for all link buttons to deprioritize them visually
// Using CSS variable directly since tailwind.config.ts was migrated to CSS in Tailwind v4
const MUTED_FOREGROUND_COLOR = "hsl(var(--muted-foreground))";

function CopyButton({
  copyStr,
  successMessage,
}: {
  copyStr: string;
  successMessage: string;
}) {
  const hoverBackground = safeUseColor("bgAccentHover");
  const fillColor = MUTED_FOREGROUND_COLOR;
  const copy = async () => navigator.clipboard.writeText(copyStr);
  const notify = async () => toast.success(successMessage);
  return (
    <div>
      <Button
        size={"icon"}
        variant={"outline"}
        onClick={() => copy().then(notify)}
        data-testid={"copybutton"}
        className={`${hoverBackground}`}
      >
        <Icons.Copy size={16} color={`${fillColor}`} />
      </Button>
    </div>
  );
}

export const CopyLinkButton = ({ anchor }: { anchor: string }) => (
  <CopyButton
    copyStr={
      globalThis.location?.protocol +
      "//" +
      globalThis.location?.host +
      globalThis.location?.pathname +
      `#${encodeURIComponent(anchor)}`
    }
    successMessage="Link copied"
  />
);

export default CopyButton;
