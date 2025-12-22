"use client";

import { toast } from "sonner";
import tailwind from "tailwind.config";
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
const themes = tailwind.theme.extend.colors;

const themeColor = () => {
  // T3C-822: Use muted gray for all link buttons to deprioritize them visually
  return themes.muted.foreground;
};

function CopyButton({
  copyStr,
  successMessage,
}: {
  copyStr: string;
  successMessage: string;
}) {
  const hoverBackground = safeUseColor("bgAccentHover");
  const fillColor = themeColor();
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
