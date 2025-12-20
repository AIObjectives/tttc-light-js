/**
 * Tests for WordLimitExpandableText component
 *
 * Covers:
 * - Word count truncation logic
 * - Show more/less button visibility
 * - Expand/collapse behavior
 * - Accessibility attributes
 * - Edge cases (empty text, exact limit, custom limit)
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { WordLimitExpandableText } from "./WordLimitExpandableText";

// Clean up after each test to prevent DOM accumulation
afterEach(() => {
  cleanup();
});

// Helper to generate text with exact word count
const generateWords = (count: number): string =>
  Array.from({ length: count }, (_, i) => `word${i}`).join(" ");

describe("WordLimitExpandableText", () => {
  describe("Truncation logic", () => {
    it("does not truncate text under word limit", () => {
      const shortText = generateWords(50);
      const { container } = render(
        <WordLimitExpandableText text={shortText} wordLimit={180} />,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toBe(`${shortText} `);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("does not truncate text exactly at word limit", () => {
      const exactText = generateWords(180);
      const { container } = render(
        <WordLimitExpandableText text={exactText} wordLimit={180} />,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toBe(`${exactText} `);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("truncates text over word limit with ellipsis", () => {
      const longText = generateWords(200);
      const { container } = render(
        <WordLimitExpandableText text={longText} wordLimit={180} />,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toContain("...");
      expect(paragraph?.textContent).not.toContain("word199");
    });

    it("respects custom wordLimit prop", () => {
      const text = generateWords(20);
      const { container } = render(
        <WordLimitExpandableText text={text} wordLimit={10} />,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toContain("word9");
      expect(paragraph?.textContent).toContain("...");
      expect(paragraph?.textContent).not.toContain("word10");
    });

    it("uses default wordLimit of 180 when not specified", () => {
      const text = generateWords(185);
      render(<WordLimitExpandableText text={text} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Button visibility", () => {
    it("shows 'Show more' button only when truncated", () => {
      const longText = generateWords(200);
      render(<WordLimitExpandableText text={longText} wordLimit={180} />);

      expect(
        screen.getByRole("button", { name: "Show more" }),
      ).toBeInTheDocument();
    });

    it("does not show button when text fits within limit", () => {
      const shortText = generateWords(50);
      render(<WordLimitExpandableText text={shortText} wordLimit={180} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Expand/collapse behavior", () => {
    it("expands to full text on button click", async () => {
      const user = userEvent.setup();
      const longText = generateWords(200);
      const { container } = render(
        <WordLimitExpandableText text={longText} wordLimit={180} />,
      );

      // Initially truncated
      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).not.toContain("word199");

      // Click to expand
      await user.click(screen.getByRole("button", { name: "Show more" }));

      // Now shows full text
      expect(paragraph?.textContent).toContain("word199");
    });

    it("shows 'Show less' button when expanded", async () => {
      const user = userEvent.setup();
      const longText = generateWords(200);
      render(<WordLimitExpandableText text={longText} wordLimit={180} />);

      await user.click(screen.getByRole("button", { name: "Show more" }));

      expect(
        screen.getByRole("button", { name: "Show less" }),
      ).toBeInTheDocument();
    });

    it("collapses back on second button click", async () => {
      const user = userEvent.setup();
      const longText = generateWords(200);
      const { container } = render(
        <WordLimitExpandableText text={longText} wordLimit={180} />,
      );

      const paragraph = container.querySelector("p");

      // Expand
      await user.click(screen.getByRole("button", { name: "Show more" }));
      expect(paragraph?.textContent).toContain("word199");

      // Collapse
      await user.click(screen.getByRole("button", { name: "Show less" }));
      expect(paragraph?.textContent).not.toContain("word199");
      expect(
        screen.getByRole("button", { name: "Show more" }),
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has correct aria-expanded attribute when collapsed", () => {
      const longText = generateWords(200);
      render(<WordLimitExpandableText text={longText} wordLimit={180} />);

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("has correct aria-expanded attribute when expanded", async () => {
      const user = userEvent.setup();
      const longText = generateWords(200);
      render(<WordLimitExpandableText text={longText} wordLimit={180} />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("button has type='button' to prevent form submission", () => {
      const longText = generateWords(200);
      render(<WordLimitExpandableText text={longText} wordLimit={180} />);

      expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    });
  });

  describe("Edge cases", () => {
    it("handles empty text gracefully", () => {
      const { container } = render(
        <WordLimitExpandableText text="" wordLimit={180} />,
      );

      expect(container.querySelector("p")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("handles text with multiple spaces correctly", () => {
      const text = "word1   word2    word3"; // Multiple spaces
      render(<WordLimitExpandableText text={text} wordLimit={2} />);

      // Should count as 3 words, truncate at 2
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("handles text with leading/trailing whitespace", () => {
      const text = "  word1 word2  ";
      render(<WordLimitExpandableText text={text} wordLimit={5} />);

      // Should count as 2 words, no truncation needed
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("handles single word text", () => {
      const { container } = render(
        <WordLimitExpandableText text="hello" wordLimit={180} />,
      );

      expect(container.querySelector("p")?.textContent).toContain("hello");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("handles wordLimit of 1", () => {
      const text = "first second third";
      const { container } = render(
        <WordLimitExpandableText text={text} wordLimit={1} />,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.textContent).toContain("first...");
      expect(paragraph?.textContent).not.toContain("second");
    });
  });

  describe("className prop", () => {
    it("applies custom className to paragraph", () => {
      const { container } = render(
        <WordLimitExpandableText
          text="some text"
          wordLimit={180}
          className="custom-class"
        />,
      );

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("works without className prop", () => {
      expect(() => {
        render(<WordLimitExpandableText text="some text" wordLimit={180} />);
      }).not.toThrow();
    });
  });
});
