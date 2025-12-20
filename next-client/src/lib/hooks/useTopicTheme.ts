"use client";

import { useContext } from "react";
import { TopicContext } from "@/components/topic/Topic";
import { type ColorVariant, getThemeColor } from "@/lib/color";

/**
 * Variation of getThemeColor that uses the topic context instead of a prop
 */
function useThemeContextColor(variant: ColorVariant) {
  const { topicNode } = useContext(TopicContext);

  return getThemeColor(topicNode.data?.topicColor, variant);
}

export { useThemeContextColor };
