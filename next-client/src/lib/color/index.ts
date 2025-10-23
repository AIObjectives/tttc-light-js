import { ThemeColor, ColorVariant, ThemeMap, themeColorMap } from "./types";
import * as schema from "tttc-common/schema";

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

export function getStrictColor<Color extends ThemeColor>(
  color: Color | string,
) {
  const colorParse = schema.topicColors.safeParse(color);
  const strictColor = (
    colorParse.success
      ? colorParse.data
      : (() => {
          return schema.topicColors.options[
            Math.floor(murmurhash(color) * schema.topicColors.options.length)
          ];
        })()
  ) as Color;
  return strictColor;
}

/**
 * Gets the correct className for the topic color and variation
 *
 * If a topic color is provided that doesn't match what we expect, it instead maps that color to one of our topic colors.
 */
export function getThemeColor<
  Color extends ThemeColor,
  Variant extends ColorVariant,
>(color: Color | string, variant: Variant): ThemeMap[Color][Variant] {
  const strictColor = getStrictColor(color);

  return themeColorMap[strictColor][variant];
}

export * from "./types";
