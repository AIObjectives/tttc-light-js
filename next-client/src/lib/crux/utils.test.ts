/**
 * Unit tests for crux utility functions
 */

import type * as schema from "tttc-common/schema";
import { describe, expect, it } from "vitest";
import {
  filterValidSpeakers,
  findSubtopicId,
  formatControversyScore,
  getControversyCategory,
  getControversyColors,
  getSortedCruxes,
  getSubtopicCrux,
  getTopicControversy,
  parseSpeaker,
} from "./utils";

describe("getTopicControversy", () => {
  it("returns controversy score for existing topic", () => {
    const addOns: schema.AddOns = {
      topicScores: [
        {
          topic: "AI Safety",
          averageControversy: 0.8,
          subtopicCount: 2,
          totalSpeakers: 5,
        },
        {
          topic: "Healthcare",
          averageControversy: 0.6,
          subtopicCount: 1,
          totalSpeakers: 3,
        },
      ],
    };

    expect(getTopicControversy(addOns, "AI Safety")).toBe(0.8);
    expect(getTopicControversy(addOns, "Healthcare")).toBe(0.6);
  });

  it("returns undefined for non-existent topic", () => {
    const addOns: schema.AddOns = {
      topicScores: [
        {
          topic: "AI Safety",
          averageControversy: 0.8,
          subtopicCount: 2,
          totalSpeakers: 5,
        },
      ],
    };

    expect(getTopicControversy(addOns, "Unknown Topic")).toBeUndefined();
  });

  it("returns undefined when addOns is undefined", () => {
    expect(getTopicControversy(undefined, "AI Safety")).toBeUndefined();
  });

  it("returns undefined when topicScores is missing", () => {
    const addOns: schema.AddOns = {};
    expect(getTopicControversy(addOns, "AI Safety")).toBeUndefined();
  });
});

describe("getSubtopicCrux", () => {
  it("returns crux for existing topic/subtopic", () => {
    const addOns: schema.AddOns = {
      subtopicCruxes: [
        {
          topic: "AI Safety",
          subtopic: "Regulation",
          cruxClaim: "Government should regulate AI",
          agree: ["1:Alice"],
          disagree: ["2:Bob"],
          no_clear_position: [],
          explanation: "Test explanation",
          agreementScore: 0.5,
          disagreementScore: 0.5,
          controversyScore: 1.0,
          speakersInvolved: 2,
          totalSpeakersInSubtopic: 2,
        },
      ],
    };

    const crux = getSubtopicCrux(addOns, "AI Safety", "Regulation");
    expect(crux).toBeDefined();
    expect(crux?.cruxClaim).toBe("Government should regulate AI");
  });

  it("returns undefined for non-existent topic/subtopic", () => {
    const addOns: schema.AddOns = {
      subtopicCruxes: [
        {
          topic: "AI Safety",
          subtopic: "Regulation",
          cruxClaim: "Test",
          agree: [],
          disagree: [],
          no_clear_position: [],
          explanation: "",
          agreementScore: 0,
          disagreementScore: 0,
          controversyScore: 0,
          speakersInvolved: 0,
          totalSpeakersInSubtopic: 0,
        },
      ],
    };

    expect(getSubtopicCrux(addOns, "Unknown", "Unknown")).toBeUndefined();
  });

  it("returns undefined when addOns is undefined", () => {
    expect(
      getSubtopicCrux(undefined, "AI Safety", "Regulation"),
    ).toBeUndefined();
  });
});

describe("formatControversyScore", () => {
  it("formats score 0-1 as X/10", () => {
    expect(formatControversyScore(1.0)).toBe("10.0/10");
    expect(formatControversyScore(0.5)).toBe("5.0/10");
    expect(formatControversyScore(0.0)).toBe("0.0/10");
    expect(formatControversyScore(0.75)).toBe("7.5/10");
  });
});

describe("getControversyColors", () => {
  it("returns orange colors for high controversy (>=0.50)", () => {
    const colors = getControversyColors(0.8);
    expect(colors.bg).toBe("bg-orange-100");
    expect(colors.text).toBe("text-orange-800");
    expect(colors.border).toBe("border-orange-300");
  });

  it("returns yellow colors for moderate controversy (>=0.20 and <0.50)", () => {
    const colors = getControversyColors(0.35);
    expect(colors.bg).toBe("bg-yellow-100");
    expect(colors.text).toBe("text-yellow-800");
    expect(colors.border).toBe("border-yellow-300");
  });

  it("returns green colors for low controversy (<0.20)", () => {
    const colors = getControversyColors(0.1);
    expect(colors.bg).toBe("bg-green-100");
    expect(colors.text).toBe("text-green-800");
    expect(colors.border).toBe("border-green-300");
  });
});

describe("getSortedCruxes", () => {
  it("sorts cruxes by controversy score descending", () => {
    const addOns: schema.AddOns = {
      subtopicCruxes: [
        {
          topic: "A",
          subtopic: "1",
          cruxClaim: "Low",
          agree: [],
          disagree: [],
          no_clear_position: [],
          explanation: "",
          agreementScore: 0,
          disagreementScore: 0,
          controversyScore: 0.3,
          speakersInvolved: 0,
          totalSpeakersInSubtopic: 0,
        },
        {
          topic: "B",
          subtopic: "2",
          cruxClaim: "High",
          agree: [],
          disagree: [],
          no_clear_position: [],
          explanation: "",
          agreementScore: 0,
          disagreementScore: 0,
          controversyScore: 0.9,
          speakersInvolved: 0,
          totalSpeakersInSubtopic: 0,
        },
        {
          topic: "C",
          subtopic: "3",
          cruxClaim: "Medium",
          agree: [],
          disagree: [],
          no_clear_position: [],
          explanation: "",
          agreementScore: 0,
          disagreementScore: 0,
          controversyScore: 0.6,
          speakersInvolved: 0,
          totalSpeakersInSubtopic: 0,
        },
      ],
    };

    const sorted = getSortedCruxes(addOns);
    expect(sorted).toHaveLength(3);
    expect(sorted[0].cruxClaim).toBe("High");
    expect(sorted[1].cruxClaim).toBe("Medium");
    expect(sorted[2].cruxClaim).toBe("Low");
  });

  it("returns empty array when addOns is undefined", () => {
    expect(getSortedCruxes(undefined)).toEqual([]);
  });

  it("returns empty array when subtopicCruxes is missing", () => {
    expect(getSortedCruxes({})).toEqual([]);
  });
});

describe("parseSpeaker", () => {
  it("parses basic format 'id:name'", () => {
    const result = parseSpeaker("1:Alice");
    expect(result.id).toBe("1");
    expect(result.name).toBe("Alice");
    expect(result.strength).toBeUndefined();
  });

  it("parses format with strength 'id:name | 0.8'", () => {
    const result = parseSpeaker("2:Bob | 0.8");
    expect(result.id).toBe("2");
    expect(result.name).toBe("Bob");
    expect(result.strength).toBe(0.8);
  });

  it("handles names with colons", () => {
    const result = parseSpeaker("3:Dr. Smith: MD");
    expect(result.id).toBe("3");
    expect(result.name).toBe("Dr. Smith: MD");
  });

  it("handles invalid strength gracefully", () => {
    const result = parseSpeaker("4:Charlie | invalid");
    expect(result.id).toBe("4");
    expect(result.name).toBe("Charlie");
    expect(result.strength).toBeUndefined();
  });

  it("handles malformed input with defaults", () => {
    const result = parseSpeaker("malformed");
    expect(result.id).toBe("malformed");
    expect(result.name).toBe("Unknown Speaker");
    expect(result.strength).toBeUndefined();
  });

  it("handles empty string", () => {
    const result = parseSpeaker("");
    expect(result.id).toBe("");
    expect(result.name).toBe("Unknown Speaker");
    expect(result.strength).toBeUndefined();
  });

  it("handles null and undefined inputs", () => {
    // @ts-expect-error - Testing runtime handling of invalid input
    const nullResult = parseSpeaker(null);
    expect(nullResult.id).toBe("");
    expect(nullResult.name).toBe("Unknown Speaker");
    expect(nullResult.strength).toBeUndefined();

    // @ts-expect-error - Testing runtime handling of invalid input
    const undefinedResult = parseSpeaker(undefined);
    expect(undefinedResult.id).toBe("");
    expect(undefinedResult.name).toBe("Unknown Speaker");
    expect(undefinedResult.strength).toBeUndefined();
  });

  it("handles strength values at boundaries", () => {
    // Zero strength
    const zeroResult = parseSpeaker("5:Dave | 0");
    expect(zeroResult.strength).toBe(0);

    // Negative strength (still valid number)
    const negativeResult = parseSpeaker("6:Eve | -0.5");
    expect(negativeResult.strength).toBe(-0.5);

    // Very large strength
    const largeResult = parseSpeaker("7:Frank | 999.999");
    expect(largeResult.strength).toBe(999.999);
  });

  it("handles edge cases in strength parsing", () => {
    // Infinity
    const infinityResult = parseSpeaker("8:Grace | Infinity");
    expect(infinityResult.strength).toBeUndefined();

    // NaN
    const nanResult = parseSpeaker("9:Henry | NaN");
    expect(nanResult.strength).toBeUndefined();

    // Empty strength part
    const emptyResult = parseSpeaker("10:Ivy | ");
    expect(emptyResult.strength).toBeUndefined();
  });

  it("handles whitespace variations", () => {
    // Extra spaces around pipe
    const spacedResult = parseSpeaker("11:Jack   |   0.9");
    expect(spacedResult.id).toBe("11");
    expect(spacedResult.name).toBe("Jack");
    expect(spacedResult.strength).toBe(0.9);

    // Leading/trailing spaces in name
    const nameSpaceResult = parseSpeaker("12:  Kate  ");
    expect(nameSpaceResult.id).toBe("12");
    expect(nameSpaceResult.name).toBe("Kate");
  });

  it("handles empty name after colon", () => {
    const result = parseSpeaker("13:");
    expect(result.id).toBe("13");
    expect(result.name).toBe("Unknown Speaker");
    expect(result.strength).toBeUndefined();
  });
});

describe("findSubtopicId", () => {
  const topics: schema.Topic[] = [
    {
      id: "topic1",
      title: "AI Safety",
      description: "Desc",
      topicColor: "blue",
      subtopics: [
        {
          id: "subtopic1",
          title: "Regulation",
          description: "Reg desc",
          claims: [],
        },
        {
          id: "subtopic2",
          title: "Research",
          description: "Research desc",
          claims: [],
        },
      ],
    },
    {
      id: "topic2",
      title: "Healthcare",
      description: "Desc",
      topicColor: "green",
      subtopics: [
        {
          id: "subtopic3",
          title: "Coverage",
          description: "Coverage desc",
          claims: [],
        },
      ],
    },
  ];

  it("finds subtopic ID for existing topic/subtopic", () => {
    expect(findSubtopicId(topics, "AI Safety", "Regulation")).toBe("subtopic1");
    expect(findSubtopicId(topics, "AI Safety", "Research")).toBe("subtopic2");
    expect(findSubtopicId(topics, "Healthcare", "Coverage")).toBe("subtopic3");
  });

  it("returns null for non-existent topic", () => {
    expect(findSubtopicId(topics, "Unknown", "Regulation")).toBeNull();
  });

  it("returns null for non-existent subtopic", () => {
    expect(findSubtopicId(topics, "AI Safety", "Unknown")).toBeNull();
  });

  it("returns null for empty topics array", () => {
    expect(findSubtopicId([], "AI Safety", "Regulation")).toBeNull();
  });
});

describe("getControversyCategory", () => {
  it("categorizes scores correctly at boundaries", () => {
    // High: >= 0.50
    expect(getControversyCategory(0.5).level).toBe("high");
    expect(getControversyCategory(1.0).level).toBe("high");
    expect(getControversyCategory(0.85).level).toBe("high");

    // Moderate: >= 0.20 and < 0.50
    expect(getControversyCategory(0.2).level).toBe("moderate");
    expect(getControversyCategory(0.49).level).toBe("moderate");
    expect(getControversyCategory(0.35).level).toBe("moderate");

    // Low: < 0.20
    expect(getControversyCategory(0.19).level).toBe("low");
    expect(getControversyCategory(0.1).level).toBe("low");
    expect(getControversyCategory(0.0).level).toBe("low");
  });

  it("includes correct labels and descriptions", () => {
    const high = getControversyCategory(0.8);
    expect(high.label).toBe("High");
    expect(high.description).toBe(
      "Significant disagreement among participants",
    );

    const moderate = getControversyCategory(0.35);
    expect(moderate.label).toBe("Moderate");
    expect(moderate.description).toBe("Some disagreement among participants");

    const low = getControversyCategory(0.1);
    expect(low.label).toBe("Low");
    expect(low.description).toBe("General consensus among participants");
  });

  it("throws error for scores below 0", () => {
    expect(() => getControversyCategory(-0.1)).toThrow(
      "Controversy score must be between 0 and 1, got: -0.1",
    );
    expect(() => getControversyCategory(-1.0)).toThrow(
      "Controversy score must be between 0 and 1, got: -1",
    );
  });

  it("throws error for scores above 1", () => {
    expect(() => getControversyCategory(1.1)).toThrow(
      "Controversy score must be between 0 and 1, got: 1.1",
    );
    expect(() => getControversyCategory(2.0)).toThrow(
      "Controversy score must be between 0 and 1, got: 2",
    );
  });

  it("throws error for non-finite values", () => {
    expect(() => getControversyCategory(Infinity)).toThrow(
      "Controversy score must be between 0 and 1, got: Infinity",
    );
    expect(() => getControversyCategory(-Infinity)).toThrow(
      "Controversy score must be between 0 and 1, got: -Infinity",
    );
    expect(() => getControversyCategory(NaN)).toThrow(
      "Controversy score must be between 0 and 1, got: NaN",
    );
  });

  it("handles exact threshold boundary values correctly", () => {
    // Test exact boundary values don't cause category errors
    expect(getControversyCategory(0.0).level).toBe("low");
    expect(getControversyCategory(0.34).level).toBe("moderate");
    expect(getControversyCategory(0.67).level).toBe("high");
    expect(getControversyCategory(1.0).level).toBe("high");
  });
});

describe("filterValidSpeakers", () => {
  it("filters out empty strings", () => {
    const input = ["1:Alice", "", "2:Bob"];
    const result = filterValidSpeakers(input);
    expect(result).toEqual(["1:Alice", "2:Bob"]);
  });

  it("filters out whitespace-only strings", () => {
    const input = ["1:Alice", "  ", "\t", "\n", "2:Bob"];
    const result = filterValidSpeakers(input);
    expect(result).toEqual(["1:Alice", "2:Bob"]);
  });

  it("keeps strings with content and whitespace", () => {
    const input = ["  1:Alice  ", "2:Bob\n"];
    const result = filterValidSpeakers(input);
    expect(result).toEqual(["  1:Alice  ", "2:Bob\n"]);
  });

  it("returns empty array for all-invalid input", () => {
    const input = ["", "  ", "\t", "\n"];
    const result = filterValidSpeakers(input);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    const result = filterValidSpeakers([]);
    expect(result).toEqual([]);
  });

  it("preserves order of valid speakers", () => {
    const input = ["3:Charlie", "", "1:Alice", "  ", "2:Bob"];
    const result = filterValidSpeakers(input);
    expect(result).toEqual(["3:Charlie", "1:Alice", "2:Bob"]);
  });
});
