import { useCallback, useMemo } from "react";
import type { TopicNode } from "@/stores/types";

interface TopicLookups {
  getTopicColor: (topicTitle: string) => string | undefined;
  getSubtopicId: (topicTitle: string, subtopicTitle: string) => string | null;
}

/**
 * Hook that builds lookup maps for topic colors and subtopic IDs.
 * Extracts this logic from the Report component to reduce cyclomatic complexity.
 */
export function useTopicLookups(storeTopics: TopicNode[]): TopicLookups {
  // Build topic color map for AgreeDisagreeSpectrum
  const topicColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    storeTopics.forEach((topic) => {
      if (topic.data?.topicColor) {
        colorMap.set(topic.data.title, topic.data.topicColor);
      }
    });
    return colorMap;
  }, [storeTopics]);

  const getTopicColor = useCallback(
    (topicTitle: string): string | undefined => {
      return topicColorMap.get(topicTitle);
    },
    [topicColorMap],
  );

  // Build subtopic ID map for navigation from cruxes outline
  const subtopicIdMap = useMemo(() => {
    const idMap = new Map<string, string>();
    const subtopicOnly = new Map<string, string>();
    storeTopics.forEach((topic) => {
      topic.data.subtopics.forEach((subtopic) => {
        idMap.set(`${topic.data.title}::${subtopic.title}`, subtopic.id);
        subtopicOnly.set(subtopic.title, subtopic.id);
      });
    });
    return { idMap, subtopicOnly };
  }, [storeTopics]);

  const getSubtopicId = useCallback(
    (topicTitle: string, subtopicTitle: string): string | null => {
      const exactMatch = subtopicIdMap.idMap.get(
        `${topicTitle}::${subtopicTitle}`,
      );
      if (exactMatch) return exactMatch;
      return subtopicIdMap.subtopicOnly.get(subtopicTitle) ?? null;
    },
    [subtopicIdMap],
  );

  return { getTopicColor, getSubtopicId };
}
