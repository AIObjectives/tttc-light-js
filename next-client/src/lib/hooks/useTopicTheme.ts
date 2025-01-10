"use client";

import { TopicContext } from "@src/components/topic/Topic";
import { useContext, useRef } from "react";
import * as schema from "tttc-common/schema";

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
} as const;

// Type for theme colors
type ThemeMap = typeof themeColorMap;
type ThemeColor = keyof ThemeMap;
type ColorVariant = keyof ThemeMap[ThemeColor];
type ThemeClass = ThemeMap[ThemeColor][ColorVariant];

/**
 * An implementation of MurmurHash3's mixing function.
 * Returns a number between 0 and 1.
 *
 * Should be relatively evenly distributed across input.
 */
const murmurhash = (str: string): number => {
  let h = 1779033703 ^ str.length;

  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^= h >>> 16) >>> 0;

  return h / 0xffffffff;
};

/**
 * Gets the correct className for the topic color and variation
 *
 * If a topic color is provided that doesn't match what we expect, it instead maps that color to one of our topic colors.
 */
function useThemeColor(
  color: string,
  variant: ColorVariant,
): ThemeClass | string {
  const colorParse = schema.topicColors.safeParse(color);
  // For now, if an unexpected color is passed, map that color to one of our colors
  const strictColor = colorParse.success
    ? colorParse.data
    : schema.topicColors.options[
        Math.floor(murmurhash(color) * schema.topicColors.options.length)
      ];
  const colorClass = useRef(themeColorMap[strictColor][variant]);
  return colorClass.current;
}

/**
 * Variation of useThemeColor that uses the topic context instead of a prop
 */
function useThemeContextColor(variant: ColorVariant) {
  const { topicNode } = useContext(TopicContext);

  return useThemeColor(topicNode.data?.topicColor, variant);
}

export { themeColorMap, useThemeColor, useThemeContextColor };
export type { ThemeColor, ColorVariant, ThemeClass };
