/**
 * Tests for ExpandableText component
 *
 * Covers:
 * - Text rendering
 * - Show more/less button visibility (mocked truncation)
 * - Expand/collapse behavior
 * - Accessibility attributes
 * - Edge cases (empty text, short text)
 * - ResizeObserver cleanup
 *
 * Note: Since ExpandableText relies on DOM measurement (scrollHeight, clientWidth),
 * we mock the truncation behavior rather than testing exact truncation points.
 */

import React from "react";
import {
  describe,
  it,
  expect,
  afterEach,
  beforeEach,
  vi,
  type Mock,
} from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpandableText } from "./ExpandableText";

// Mock ResizeObserver
let resizeObserverCallback: ResizeObserverCallback | null = null;
let resizeObserverDisconnect: Mock;

// Track whether measurement should indicate truncation
let shouldTruncate = false;

// Store original descriptors for cleanup
let originalClientWidth: PropertyDescriptor | undefined;

beforeEach(() => {
  resizeObserverDisconnect = vi.fn();

  global.ResizeObserver = vi.fn().mockImplementation((callback) => {
    resizeObserverCallback = callback;
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: resizeObserverDisconnect,
    };
  });

  // Mock clientWidth on all elements
  originalClientWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    get: () => 500,
    configurable: true,
  });

  // Mock getComputedStyle to return realistic values
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const original = originalGetComputedStyle(element);
    const mockStyle = {
      lineHeight: "20px",
      fontSize: "16px",
      font: "16px sans-serif",
      letterSpacing: "normal",
    };
    return {
      ...original,
      ...mockStyle,
      getPropertyValue: (prop: string) => {
        const camelProp = prop.replace(/-([a-z])/g, (g) =>
          g[1].toUpperCase(),
        ) as keyof typeof mockStyle;
        return mockStyle[camelProp] || original.getPropertyValue(prop);
      },
    } as CSSStyleDeclaration;
  });

  // Mock document.createElement to control scrollHeight on measurement spans
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    const element = originalCreateElement(tagName);
    if (tagName === "span") {
      Object.defineProperty(element, "scrollHeight", {
        // With lineHeight=20, maxHeight = 20*2+4 = 44
        // So scrollHeight of 30 fits (no truncation), 100 exceeds (truncation)
        get: () => (shouldTruncate ? 100 : 30),
        configurable: true,
      });
    }
    return element;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resizeObserverCallback = null;
  shouldTruncate = false;

  // Restore original clientWidth
  if (originalClientWidth) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientWidth",
      originalClientWidth,
    );
  }
});

// Helper to set truncation behavior for test
const setTruncation = (truncate: boolean) => {
  shouldTruncate = truncate;
};

describe("ExpandableText", () => {
  describe("Basic rendering", () => {
    it("renders text content in a paragraph element", () => {
      setTruncation(false);
      const { container } = render(
        <ExpandableText>Hello world</ExpandableText>,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
      expect(paragraph?.textContent).toContain("Hello world");
    });

    it("renders string children directly", () => {
      setTruncation(false);
      const { container } = render(
        <ExpandableText>Simple text content</ExpandableText>,
      );

      expect(container.querySelector("p")?.textContent).toContain(
        "Simple text content",
      );
    });

    it("converts non-string children to string", () => {
      setTruncation(false);
      const { container } = render(<ExpandableText>{12345}</ExpandableText>);

      expect(container.querySelector("p")?.textContent).toContain("12345");
    });

    it("handles null/undefined children gracefully", () => {
      setTruncation(false);
      const { container } = render(<ExpandableText>{null}</ExpandableText>);

      expect(container.querySelector("p")).toBeInTheDocument();
    });
  });

  describe("Truncation and button visibility", () => {
    it("does not show button when text fits within lines", () => {
      setTruncation(false);
      render(<ExpandableText>Short text that fits</ExpandableText>);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows 'Show more' button when text needs truncation", () => {
      setTruncation(true);
      render(
        <ExpandableText>
          This is a very long text that will need to be truncated because it
          exceeds the maximum allowed lines and requires a show more button to
          reveal the full content.
        </ExpandableText>,
      );

      expect(
        screen.getByRole("button", { name: "Show more" }),
      ).toBeInTheDocument();
    });
  });

  describe("Expand/collapse behavior", () => {
    it("expands to show full text on button click", async () => {
      setTruncation(true);
      const user = userEvent.setup();
      const fullText =
        "This is a very long text that needs truncation to fit properly.";
      render(<ExpandableText>{fullText}</ExpandableText>);

      // Click to expand
      await user.click(screen.getByRole("button", { name: "Show more" }));

      // Button should now say "Show less"
      expect(
        screen.getByRole("button", { name: "Show less" }),
      ).toBeInTheDocument();
    });

    it("shows 'Show less' button when expanded", async () => {
      setTruncation(true);
      const user = userEvent.setup();
      render(
        <ExpandableText>
          Long text that requires truncation for proper display.
        </ExpandableText>,
      );

      await user.click(screen.getByRole("button", { name: "Show more" }));

      expect(
        screen.getByRole("button", { name: "Show less" }),
      ).toBeInTheDocument();
    });

    it("collapses back on second button click", async () => {
      setTruncation(true);
      const user = userEvent.setup();
      render(
        <ExpandableText>
          Long text that requires truncation for proper display.
        </ExpandableText>,
      );

      // Expand
      await user.click(screen.getByRole("button", { name: "Show more" }));
      expect(
        screen.getByRole("button", { name: "Show less" }),
      ).toBeInTheDocument();

      // Collapse
      await user.click(screen.getByRole("button", { name: "Show less" }));
      expect(
        screen.getByRole("button", { name: "Show more" }),
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has correct aria-expanded attribute when collapsed", () => {
      setTruncation(true);
      render(
        <ExpandableText>
          Long text requiring truncation for accessibility testing.
        </ExpandableText>,
      );

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("has correct aria-expanded attribute when expanded", async () => {
      setTruncation(true);
      const user = userEvent.setup();
      render(
        <ExpandableText>
          Long text requiring truncation for accessibility testing.
        </ExpandableText>,
      );

      await user.click(screen.getByRole("button"));

      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("button has type='button' to prevent form submission", () => {
      setTruncation(true);
      render(
        <ExpandableText>
          Long text requiring truncation for button type testing.
        </ExpandableText>,
      );

      expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    });
  });

  describe("Edge cases", () => {
    it("handles empty text gracefully", () => {
      setTruncation(false);
      const { container } = render(<ExpandableText>{""}</ExpandableText>);

      expect(container.querySelector("p")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("handles whitespace-only text", () => {
      setTruncation(false);
      const { container } = render(<ExpandableText>{"   "}</ExpandableText>);

      expect(container.querySelector("p")).toBeInTheDocument();
    });
  });

  describe("ResizeObserver behavior", () => {
    it("creates ResizeObserver on mount", () => {
      setTruncation(false);
      render(<ExpandableText>Some text content</ExpandableText>);

      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it("disconnects ResizeObserver on unmount", () => {
      setTruncation(false);
      const { unmount } = render(
        <ExpandableText>Some text content</ExpandableText>,
      );

      unmount();

      expect(resizeObserverDisconnect).toHaveBeenCalled();
    });

    it("recalculates truncation when resize callback fires", () => {
      setTruncation(true);
      render(
        <ExpandableText>
          Text that needs to recalculate on resize.
        </ExpandableText>,
      );

      // Initially should show button
      expect(screen.getByRole("button")).toBeInTheDocument();

      // Simulate resize
      act(() => {
        if (resizeObserverCallback) {
          resizeObserverCallback([], {} as ResizeObserver);
        }
      });

      // Button should still be visible (truncation recalculated)
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("className prop", () => {
    it("applies custom className to paragraph", () => {
      setTruncation(false);
      const { container } = render(
        <ExpandableText className="custom-class">Some text</ExpandableText>,
      );

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("works without className prop", () => {
      setTruncation(false);
      expect(() => {
        render(<ExpandableText>Some text</ExpandableText>);
      }).not.toThrow();
    });

    it("combines custom className with internal classes", () => {
      setTruncation(true);
      const { container } = render(
        <ExpandableText className="my-class">
          Long text that requires truncation for class testing.
        </ExpandableText>,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph?.className).toContain("my-class");
    });
  });

  describe("Props forwarding", () => {
    it("forwards additional props to paragraph element", () => {
      setTruncation(false);
      const { container } = render(
        <ExpandableText data-testid="test-paragraph" id="my-paragraph">
          Some text
        </ExpandableText>,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph).toHaveAttribute("data-testid", "test-paragraph");
      expect(paragraph).toHaveAttribute("id", "my-paragraph");
    });
  });
});
