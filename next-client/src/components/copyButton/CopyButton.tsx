"use client";

import { useThemeContextColor } from "@/lib/hooks/useTopicTheme";
import { Button } from "../elements";
import Icons from "@/assets/icons";
import { useContext } from "react";
import { toast } from "sonner";
import tailwind from "tailwind.config";
import { ColorVariant, getStrictColor } from "@/lib/color";
import { TopicContext } from "../topic/Topic";
const safeUseColor = (color: ColorVariant) => {
  try {
    return useThemeContextColor(color);
  } catch {
    return undefined;
  }
};
const themes = tailwind.theme.extend.colors;

const themeColor = () => {
  const { topicNode } = useContext(TopicContext);
  if (!topicNode.id) {
    return themes.muted.foreground;
  }
  const color = getStrictColor(topicNode.data.topicColor);

  switch (color) {
    case "blueSea":
      return themes.theme_blueSea.DEFAULT;
    case "blueSky":
      return themes.theme_blueSky.DEFAULT;
    case "brown":
      return themes.theme_brown.DEFAULT;
    case "greenLeaf":
      return themes.theme_greenLeaf.DEFAULT;
    case "greenLime":
      return themes.theme_greenLime.DEFAULT;
    case "purple":
      return themes.theme_purple.DEFAULT;
    case "red":
      return themes.theme_red.DEFAULT;
    case "violet":
      return themes.theme_violet.DEFAULT;
    case "yellow":
      return themes.theme_yellow.DEFAULT;
    default:
      return themes.muted.foreground;
  }
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
