import { TopicContext } from "@src/components/topic/Topic";
import { useContext } from "react";

export type TopicTheme = {
  backgroundColor: string;
  accentBackgroundColor: string;
  borderColor: string;
  accentBorderColor: string;
};

const themeColorMap = {
  violet: {
    bg: "bg-theme_violet",
    bgAccent: "bg-theme_violet-accent",
    bgHover: "hover:bg-theme_violet",
    bgAccentHover: "hover:bg-theme_violet-accent",
    border: "border-theme_violet",
    borderAccent: "border-theme_violet-accent",
  },
  blueSea: {
    bg: "bg-theme_blueSea",
    bgAccent: "bg-theme_blueSea-accent",
    bgHover: "hover:bg-theme_blueSea",
    bgAccentHover: "hover:bg-theme_blueSea-accent",
    border: "border-theme_blueSea",
    borderAccent: "border-theme_blueSea-accent",
  },
  blueSky: {
    bg: "bg-theme_blueSky",
    bgAccent: "bg-theme_blueSky-accent",
    bgHover: "hover:bg-theme_blueSky",
    bgAccentHover: "hover:bg-theme_blueSky-accent",
    border: "border-theme_blueSky",
    borderAccent: "border-theme_blueSky-accent",
  },
  greenLeaf: {
    bg: "bg-theme_greenLeaf",
    bgAccent: "bg-theme_greenLeaf-accent",
    bgHover: "hover:bg-theme_greenLeaf",
    bgAccentHover: "hover:bg-theme_greenLeaf-accent",
    border: "border-theme_greenLeaf",
    borderAccent: "border-theme_greenLeaf-accent",
  },
  greenLime: {
    bg: "bg-theme_greenLime",
    bgAccent: "bg-theme_greenLime-accent",
    bgHover: "hover:bg-theme_greenLime",
    bgAccentHover: "hover:bg-theme_greenLime-accent",
    border: "border-theme_greenLime",
    borderAccent: "border-theme_greenLime-accent",
  },
  yellow: {
    bg: "bg-theme_yellow",
    bgAccent: "bg-theme_yellow-accent",
    bgHover: "hover:bg-theme_yellow",
    bgAccentHover: "hover:bg-theme_yellow-accent",
    border: "border-theme_yellow",
    borderAccent: "border-theme_yellow-accent",
  },
  red: {
    bg: "bg-theme_red",
    bgAccent: "bg-theme_red-accent",
    bgHover: "hover:bg-theme_red",
    bgAccentHover: "hover:bg-theme_red-accent",
    border: "border-theme_red",
    borderAccent: "border-theme_red-accent",
  },
  purple: {
    bg: "bg-theme_purple",
    bgAccent: "bg-theme_purple-accent",
    bgHover: "hover:bg-theme_purple",
    bgAccentHover: "hover:bg-theme_purple-accent",
    border: "border-theme_purple",
    borderAccent: "border-theme_purple-accent",
  },
  brown: {
    bg: "bg-theme_brown",
    bgAccent: "bg-theme_brown-accent",
    bgHover: "hover:bg-theme_brown",
    bgAccentHover: "hover:bg-theme_brown-accent",
    border: "border-theme_brown",
    borderAccent: "border-theme_brown-accent",
  },
  gray: {
    bg: "bg-theme_gray",
    bgAccent: "bg-theme_gray-accent",
    bgHover: "hover:bg-theme_gray",
    bgAccentHover: "hover:bg-theme_gray-accent",
    border: "border-theme_gray",
    borderAccent: "border-theme_gray-accent",
  },
} as const;

// Type for theme colors
type ThemeMap = typeof themeColorMap;
type ThemeColor = keyof ThemeMap;
type ColorVariant = keyof ThemeMap[ThemeColor];
type ThemeClass = ThemeMap[ThemeColor][ColorVariant];

/**
 * Looks at the topic's color and provides the classnames needed to use in components.
 * WARNING: variant is supposed to spefically be in set of theme_x classes. However, the need to include a
 * default className waters down the type system. Find a solution to this later.
 */
function useThemeColor(
  variant: ColorVariant,
  className: string,
): ThemeClass | string {
  const { topicNode } = useContext(TopicContext);

  const colorClass = <ThemeClass | string>topicNode.data?.topicColor
    ? themeColorMap[topicNode.data.topicColor][variant]
    : className;

  return colorClass;
}

export { themeColorMap, useThemeColor };
export type { ThemeColor, ColorVariant, ThemeClass };
