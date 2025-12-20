import { useMemo } from "react";
import { parseSpeaker } from "@/lib/crux/utils";

export interface ParsedSpeaker {
  id: string;
  name: string;
}

interface CruxSpeakers {
  agree: string[];
  disagree: string[];
  no_clear_position?: string[];
}

/**
 * Hook to parse and memoize speaker arrays from crux data.
 * Consolidates speaker parsing to avoid re-parsing on every render.
 *
 * @param crux - Object containing agree, disagree, and no_clear_position arrays
 * @returns Memoized parsed speaker arrays and a speaker ID to name map
 */
export function useParsedSpeakers(crux: CruxSpeakers | null | undefined) {
  const speakerIdToName = useMemo(() => {
    if (!crux) return new Map<string, string>();

    const map = new Map<string, string>();
    const allSpeakers = [
      ...crux.agree,
      ...crux.disagree,
      ...(crux.no_clear_position || []),
    ];
    for (const speakerStr of allSpeakers) {
      const { id, name } = parseSpeaker(speakerStr);
      map.set(id, name);
    }
    return map;
  }, [crux]);

  const parsedAgree = useMemo(
    (): ParsedSpeaker[] =>
      crux?.agree.map((s) => {
        const parsed = parseSpeaker(s);
        return { id: parsed.id, name: parsed.name };
      }) ?? [],
    [crux?.agree],
  );

  const parsedDisagree = useMemo(
    (): ParsedSpeaker[] =>
      crux?.disagree.map((s) => {
        const parsed = parseSpeaker(s);
        return { id: parsed.id, name: parsed.name };
      }) ?? [],
    [crux?.disagree],
  );

  const parsedNoClear = useMemo(
    (): ParsedSpeaker[] | undefined =>
      crux?.no_clear_position?.map((s) => {
        const parsed = parseSpeaker(s);
        return { id: parsed.id, name: parsed.name };
      }),
    [crux?.no_clear_position],
  );

  const totalPeople =
    (crux?.agree.length ?? 0) +
    (crux?.disagree.length ?? 0) +
    (crux?.no_clear_position?.length ?? 0);

  return {
    speakerIdToName,
    parsedAgree,
    parsedDisagree,
    parsedNoClear,
    totalPeople,
  };
}
