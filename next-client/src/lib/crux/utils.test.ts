/**
 * Unit tests for crux utility functions
 */
import { describe, it, expect } from "vitest";
import * as schema from "tttc-common/schema";
import {
  getTopicControversy,
  getSubtopicCrux,
  formatControversyScore,
  getControversyColors,
  isSignificantControversy,
  getSortedCruxes,
  parseSpeaker,
  findSubtopicId,
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
  it("returns red colors for high controversy (>=0.7)", () => {
    const colors = getControversyColors(0.7);
    expect(colors.bg).toBe("bg-red-100");
    expect(colors.text).toBe("text-red-800");
    expect(colors.border).toBe("border-red-300");
  });

  it("returns orange colors for medium controversy (>=0.4 and <0.7)", () => {
    const colors = getControversyColors(0.5);
    expect(colors.bg).toBe("bg-orange-100");
    expect(colors.text).toBe("text-orange-800");
    expect(colors.border).toBe("border-orange-300");
  });

  it("returns green colors for low controversy (<0.4)", () => {
    const colors = getControversyColors(0.2);
    expect(colors.bg).toBe("bg-green-100");
    expect(colors.text).toBe("text-green-800");
    expect(colors.border).toBe("border-green-300");
  });
});

describe("isSignificantControversy", () => {
  it("returns true for scores >= 0.3 (3.0/10)", () => {
    expect(isSignificantControversy(0.3)).toBe(true);
    expect(isSignificantControversy(0.5)).toBe(true);
    expect(isSignificantControversy(1.0)).toBe(true);
  });

  it("returns false for scores < 0.3", () => {
    expect(isSignificantControversy(0.29)).toBe(false);
    expect(isSignificantControversy(0.1)).toBe(false);
    expect(isSignificantControversy(0.0)).toBe(false);
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
    expect(result.name).toBe("Unknown");
    expect(result.strength).toBeUndefined();
  });

  it("handles empty string", () => {
    const result = parseSpeaker("");
    expect(result.id).toBe("");
    expect(result.name).toBe("Unknown");
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
