/**
 * Tests for VisibilitySelector and FormVisibility components
 *
 * Tests cover:
 * - Rendering correct state (private/shared)
 * - Icons display (Lock/Globe)
 * - Hidden input for form submission
 * - State changes on selection
 * - FormVisibility wrapper with label and helper text
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormItemState } from "../../hooks/useFormState";
import { FormVisibility, VisibilitySelector } from "../VisibilitySelector";

// Helper to create mock FormItemState
const createMockVisibility = (
  initialState: boolean,
): FormItemState<boolean> => ({
  state: initialState,
  setState: vi.fn(),
  status: { tag: "success", value: initialState },
});

// Global cleanup to prevent DOM pollution between tests
afterEach(() => {
  cleanup();
});

describe("VisibilitySelector", () => {
  let mockVisibility: FormItemState<boolean>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("shows 'Only me' when visibility.state is false", () => {
      mockVisibility = createMockVisibility(false);
      render(<VisibilitySelector visibility={mockVisibility} />);

      expect(screen.getByText("Only me")).toBeInTheDocument();
    });

    it("shows 'Anyone with the link' when visibility.state is true", () => {
      mockVisibility = createMockVisibility(true);
      render(<VisibilitySelector visibility={mockVisibility} />);

      expect(screen.getByText("Anyone with the link")).toBeInTheDocument();
    });

    it("shows Lock icon when private", () => {
      mockVisibility = createMockVisibility(false);
      const { container } = render(
        <VisibilitySelector visibility={mockVisibility} />,
      );

      // Lock icon should be present (lucide-react renders as SVG)
      const lockIcon = container.querySelector("svg.lucide-lock");
      expect(lockIcon).toBeInTheDocument();
    });

    it("shows Globe icon when shared", () => {
      mockVisibility = createMockVisibility(true);
      const { container } = render(
        <VisibilitySelector visibility={mockVisibility} />,
      );

      // Globe icon should be present
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
    });
  });

  describe("hidden input", () => {
    it("includes hidden input with value 'on' when shared", () => {
      mockVisibility = createMockVisibility(true);
      const { container } = render(
        <VisibilitySelector visibility={mockVisibility} />,
      );

      const hiddenInput = container.querySelector(
        'input[type="hidden"][name="isPublic"]',
      );
      expect(hiddenInput).toBeInTheDocument();
      expect(hiddenInput).toHaveAttribute("value", "on");
    });

    it("does not include hidden input when private", () => {
      mockVisibility = createMockVisibility(false);
      const { container } = render(
        <VisibilitySelector visibility={mockVisibility} />,
      );

      const hiddenInput = container.querySelector(
        'input[type="hidden"][name="isPublic"]',
      );
      expect(hiddenInput).not.toBeInTheDocument();
    });
  });

  describe("interaction", () => {
    it("calls setState(true) when selecting shared option", async () => {
      const user = userEvent.setup();
      mockVisibility = createMockVisibility(false);
      render(<VisibilitySelector visibility={mockVisibility} />);

      // Open the select dropdown
      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      // Click the "Anyone with the link" option
      const sharedOption = screen.getByRole("option", {
        name: /anyone with the link/i,
      });
      await user.click(sharedOption);

      expect(mockVisibility.setState).toHaveBeenCalledWith(true);
    });

    it("calls setState(false) when selecting private option", async () => {
      const user = userEvent.setup();
      mockVisibility = createMockVisibility(true);
      render(<VisibilitySelector visibility={mockVisibility} />);

      // Open the select dropdown
      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      // Click the "Only me" option
      const privateOption = screen.getByRole("option", { name: /only me/i });
      await user.click(privateOption);

      expect(mockVisibility.setState).toHaveBeenCalledWith(false);
    });
  });
});

describe("FormVisibility", () => {
  it("renders the Visibility label", () => {
    const mockVisibility = createMockVisibility(false);
    render(<FormVisibility visibility={mockVisibility} />);

    expect(screen.getByText("Visibility")).toBeInTheDocument();
  });

  it("renders the helper text", () => {
    const mockVisibility = createMockVisibility(false);
    render(<FormVisibility visibility={mockVisibility} />);

    expect(
      screen.getByText(/only you can see the report/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you can change this later from the share button/i),
    ).toBeInTheDocument();
  });

  it("renders the VisibilitySelector component", () => {
    const mockVisibility = createMockVisibility(false);
    render(<FormVisibility visibility={mockVisibility} />);

    // Should render the select trigger
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
