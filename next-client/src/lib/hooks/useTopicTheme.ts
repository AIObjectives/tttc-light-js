"use client";

import { TopicContext } from "@src/components/topic/Topic";
import { useContext } from "react";
import * as schema from "tttc-common/schema";

const themeColorMap = {
  violet: {
    bg: "bg-theme_violet",
    bgAccent: "bg-theme_violet-accent",
    bgHover: "hover:bg-theme_violet",
    bgAccentHover: "hover:bg-theme_violet-accent",
    border: "border-theme_violet",
    borderAccent: "border-theme_violet-accent",
    text: "text-theme_violet",
    textHover: "hover:text-theme_violet",
  },
  blueSea: {
    bg: "bg-theme_blueSea",
    bgAccent: "bg-theme_blueSea-accent",
    bgHover: "hover:bg-theme_blueSea",
    bgAccentHover: "hover:bg-theme_blueSea-accent",
    border: "border-theme_blueSea",
    borderAccent: "border-theme_blueSea-accent",
    text: "text-theme_blueSea",
    textHover: "hover:text-theme_blueSea",
  },
  blueSky: {
    bg: "bg-theme_blueSky",
    bgAccent: "bg-theme_blueSky-accent",
    bgHover: "hover:bg-theme_blueSky",
    bgAccentHover: "hover:bg-theme_blueSky-accent",
    border: "border-theme_blueSky",
    borderAccent: "border-theme_blueSky-accent",
    text: "text-theme_blueSky",
    textHover: "hover:text-theme_blueSky",
  },
  greenLeaf: {
    bg: "bg-theme_greenLeaf",
    bgAccent: "bg-theme_greenLeaf-accent",
    bgHover: "hover:bg-theme_greenLeaf",
    bgAccentHover: "hover:bg-theme_greenLeaf-accent",
    border: "border-theme_greenLeaf",
    borderAccent: "border-theme_greenLeaf-accent",
    text: "text-theme_greenLeaf",
    textHover: "hover:text-theme_greenLeaf",
  },
  greenLime: {
    bg: "bg-theme_greenLime",
    bgAccent: "bg-theme_greenLime-accent",
    bgHover: "hover:bg-theme_greenLime",
    bgAccentHover: "hover:bg-theme_greenLime-accent",
    border: "border-theme_greenLime",
    borderAccent: "border-theme_greenLime-accent",
    text: "text-theme_greenLime",
    textHover: "hover:text-theme_greenLime",
  },
  yellow: {
    bg: "bg-theme_yellow",
    bgAccent: "bg-theme_yellow-accent",
    bgHover: "hover:bg-theme_yellow",
    bgAccentHover: "hover:bg-theme_yellow-accent",
    border: "border-theme_yellow",
    borderAccent: "border-theme_yellow-accent",
    text: "text-theme_yellow",
    textHover: "hover:text-theme_yellow",
  },
  red: {
    bg: "bg-theme_red",
    bgAccent: "bg-theme_red-accent",
    bgHover: "hover:bg-theme_red",
    bgAccentHover: "hover:bg-theme_red-accent",
    border: "border-theme_red",
    borderAccent: "border-theme_red-accent",
    text: "text-theme_red",
    textHover: "hover:text-theme_red",
  },
  purple: {
    bg: "bg-theme_purple",
    bgAccent: "bg-theme_purple-accent",
    bgHover: "hover:bg-theme_purple",
    bgAccentHover: "hover:bg-theme_purple-accent",
    border: "border-theme_purple",
    borderAccent: "border-theme_purple-accent",
    text: "text-theme_purple",
    textHover: "hover:text-theme_purple",
  },
  brown: {
    bg: "bg-theme_brown",
    bgAccent: "bg-theme_brown-accent",
    bgHover: "hover:bg-theme_brown",
    bgAccentHover: "hover:bg-theme_brown-accent",
    border: "border-theme_brown",
    borderAccent: "border-theme_brown-accent",
    text: "text-theme_brown",
    textHover: "hover:text-theme_brown",
  },
} as const;

/**
 * Type of themeMap, which goes maps classNames by their colors.
 *
 * i.e. brown -> {bg: bg-theme_brown, ...}
 */
type ThemeMap = typeof themeColorMap;

/**
 * Set of all colors according to ThemeMap. Should be equivalent to schema.topicColor
 */
type ThemeColor = keyof ThemeMap;

/**
 * Union of variant -> specific color's className
 */
type ColorVariantMap = ThemeMap[ThemeColor];

/**
 * Every type of class variant it could be, such as bg, accent, etc.
 */
type ColorVariant = keyof ColorVariantMap;

/**
 * Set of all classNames
 */
type ThemeClass = ColorVariantMap[ColorVariant];

/**
 * Set of all text based classNames
 */
type TextClass = ColorVariantMap["text"];

/**
 * Set of all hover based classNames
 */
type TextHoverClass = ColorVariantMap["textHover"];

/**
 * Set of all background classNames
 */
type BackgroundClass = ColorVariantMap["bg"];

/**
 * Set of all background accent classNames
 */
type BackgroundAccentClass = ColorVariantMap["bgAccent"];

/**
 * Set of all background accent hover classNames
 */
type BackgroundAccentHoverClass = ColorVariantMap["bgAccentHover"];

/**
 * Set of all border classNames
 */
type BorderClass = ColorVariantMap["border"];

/**
 * Set of all border accent classNames
 */
type BorderAccentClass = ColorVariantMap["borderAccent"];

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
function useThemeColor<Color extends ThemeColor, Variant extends ColorVariant>(
  color: Color | string,
  variant: Variant,
): ThemeMap[Color][Variant] {
  const colorParse = schema.topicColors.safeParse(color);
  const strictColor = (
    colorParse.success
      ? colorParse.data
      : schema.topicColors.options[
          Math.floor(murmurhash(color) * schema.topicColors.options.length)
        ]
  ) as Color;

  return themeColorMap[strictColor][variant];
}

/**
 * Variation of useThemeColor that uses the topic context instead of a prop
 */
function useThemeContextColor(variant: ColorVariant) {
  const { topicNode } = useContext(TopicContext);

  return useThemeColor(topicNode.data?.topicColor, variant);
}

export { themeColorMap, useThemeColor, useThemeContextColor };
export type {
  ThemeColor,
  ColorVariant,
  ThemeClass,
  TextClass,
  TextHoverClass,
  ThemeMap,
  BackgroundAccentClass,
  BackgroundAccentHoverClass,
  BackgroundClass,
  BorderAccentClass,
  BorderClass,
};
