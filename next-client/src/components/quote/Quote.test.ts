import { describe, expect, it } from "vitest";
import {
  extractYouTubeVideoId,
  formatYouTubeLink,
  parseTimestampToSeconds,
} from "./Quote";

describe("parseTimestampToSeconds", () => {
  it("converts HH:MM:SS with zero hours to 0", () => {
    expect(parseTimestampToSeconds("00:00:00")).toBe(0);
  });

  it("converts HH:MM:SS to seconds", () => {
    expect(parseTimestampToSeconds("00:01:38")).toBe(98);
  });

  it("converts HH:MM:SS with large minutes to seconds", () => {
    expect(parseTimestampToSeconds("00:12:12")).toBe(732);
  });

  it("converts HH:MM:SS with hours to seconds", () => {
    expect(parseTimestampToSeconds("1:30:00")).toBe(5400);
  });

  it("converts MM:SS to seconds", () => {
    expect(parseTimestampToSeconds("5:30")).toBe(330);
  });

  it("returns plain seconds as-is", () => {
    expect(parseTimestampToSeconds("90")).toBe(90);
  });

  it("returns 0 for empty string", () => {
    expect(parseTimestampToSeconds("")).toBe(0);
  });

  it("returns 0 for invalid string", () => {
    expect(parseTimestampToSeconds("invalid")).toBe(0);
  });
});

describe("extractYouTubeVideoId", () => {
  it("extracts video ID from watch URL", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from short youtu.be URL", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts video ID from embed URL", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URL", () => {
    expect(extractYouTubeVideoId("https://vimeo.com/123456")).toBeNull();
  });
});

describe("formatYouTubeLink", () => {
  it("converts watch URL with non-zero timestamp to embed URL with start param", () => {
    expect(
      formatYouTubeLink(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "00:01:30",
      ),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?start=90");
  });

  it("converts watch URL with zero timestamp to embed URL without start param", () => {
    expect(
      formatYouTubeLink(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "00:00:00",
      ),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("converts short youtu.be URL with timestamp to embed URL with start param", () => {
    expect(formatYouTubeLink("https://youtu.be/dQw4w9WgXcQ", "00:01:30")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?start=90",
    );
  });

  it("converts short youtu.be URL with zero timestamp to embed URL without start param", () => {
    expect(formatYouTubeLink("https://youtu.be/dQw4w9WgXcQ", "00:00:00")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("preserves already-embedded URL and appends start param", () => {
    expect(
      formatYouTubeLink(
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "00:04:41",
      ),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?start=281");
  });

  it("preserves already-embedded URL with zero timestamp without start param", () => {
    expect(
      formatYouTubeLink(
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "00:00:00",
      ),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("returns empty string for YouTube URL with no video ID", () => {
    expect(
      formatYouTubeLink(
        "https://www.youtube.com/playlist?list=PLxxx",
        "00:00:00",
      ),
    ).toBe("");
  });
});
