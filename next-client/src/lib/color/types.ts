import * as schema from "tttc-common/schema";

export const themeColorMap = {
  violet: {
    bg: "bg-theme_violet",
    bgAccent: "bg-theme_violet-accent",
    bgHover: "hover:bg-theme_violet",
    bgAccentHover: "hover:bg-theme_violet-accent",
    border: "border-theme_violet",
    borderAccent: "border-theme_violet-accent",
    text: "text-theme_violet",
    textHover: "hover:text-theme_violet",
    groupHoverBgAccent: "group-hover:bg-theme_violet-accent",
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
    groupHoverBgAccent: "group-hover:bg-theme_blueSea-accent",
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
    groupHoverBgAccent: "group-hover:bg-theme_blueSky-accent",
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
    groupHoverBgAccent: "group-hover:bg-theme_greenLeaf-accent",
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
    groupHoverBgAccent: "group-hover:bg-theme_greenLime-accent",
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
    groupHoverBgAccent: "group-hover:bg-theme_yellow-accent",
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
    groupHoverBgAccent: "group-hover:bg-theme_red-accent",
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
    groupHoverBgAccent: "group-hover:bg-theme_purple-accent",
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
    groupHoverBgAccent: "group-hover:bg-theme_brown-accent",
  },
} as const;

/**
 * Type of themeMap, which goes maps classNames by their colors.
 *
 * i.e. brown -> {bg: bg-theme_brown, ...}
 */
export type ThemeMap = typeof themeColorMap;

/**
 * Set of all colors according to ThemeMap. Should be equivalent to schema.topicColor
 */
export type ThemeColor = keyof ThemeMap;

/**
 * Union of variant -> specific color's className
 */
export type ColorVariantMap = ThemeMap[ThemeColor];

/**
 * Every type of class variant it could be, such as bg, accent, etc.
 */
export type ColorVariant = keyof ColorVariantMap;

/**
 * Set of all classNames
 */
export type ThemeClass = ColorVariantMap[ColorVariant];

/**
 * Set of all text based classNames
 */
export type TextClass = ColorVariantMap["text"];

/**
 * Set of all hover based classNames
 */
export type TextHoverClass = ColorVariantMap["textHover"];

/**
 * Set of all background classNames
 */
export type BackgroundClass = ColorVariantMap["bg"];

/**
 * Set of all background accent classNames
 */
export type BackgroundAccentClass = ColorVariantMap["bgAccent"];

/**
 * Set of all background accent hover classNames
 */
export type BackgroundAccentHoverClass = ColorVariantMap["bgAccentHover"];

/**
 * Set of all border classNames
 */
export type BorderClass = ColorVariantMap["border"];

/**
 * Set of all border accent classNames
 */
export type BorderAccentClass = ColorVariantMap["borderAccent"];

/**
 * Set of all group-hover:bg-accent
 */
export type GroupHoverBgAccent = ColorVariantMap["groupHoverBgAccent"];
