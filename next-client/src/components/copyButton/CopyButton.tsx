"use client";

import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";
import { Button } from "../elements";
import Icons from "@/assets/icons";
import { ReactNode } from "react";
import { toast } from "sonner";
import tailwind from "tailwind.config";

const safeUseBackgroundHoverColor = () => {
  try {
    return useThemeContextColor("bgAccentHover");
  } catch {
    return undefined;
  }
};

function CopyButton({
  copyStr,
  successMessage,
}: {
  copyStr: string;
  successMessage: string;
}) {
  const hoverBackground = safeUseBackgroundHoverColor();
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
        <Icons.Copy
          size={16}
          color={`${tailwind.theme.extend.colors.muted.foreground}`}
        />
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
