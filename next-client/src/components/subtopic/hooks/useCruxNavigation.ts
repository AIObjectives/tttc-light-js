import type React from "react";

// Scroll offset to account for fixed navbar height
const NAVBAR_SCROLL_OFFSET = -80;

type ContentTab = "report" | "cruxes";

interface UseCruxNavigationProps {
  cruxId: string;
  subtopicTitle: string;
  activeContentTab: ContentTab;
  setActiveContentTab: (tab: ContentTab) => void;
  scrollToAfterRender: (id: string) => void;
}

/**
 * Hook to handle navigation interactions for crux display.
 * Handles clicking on the crux (navigates to Cruxes tab) and
 * clicking on the subtopic link (navigates to Report tab).
 */
export function useCruxNavigation({
  cruxId,
  subtopicTitle,
  activeContentTab,
  setActiveContentTab,
  scrollToAfterRender,
}: UseCruxNavigationProps) {
  // Handle click: Navigate to Cruxes tab and scroll to this crux
  const handleCruxClick = () => {
    setActiveContentTab("cruxes");
    scrollToAfterRender(cruxId);
  };

  // Handle subtopic click: Navigate to Report tab and scroll to subtopic
  const handleSubtopicClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const needsTabSwitch = activeContentTab !== "report";

    if (needsTabSwitch) {
      // Switch to report tab first, then scroll after render completes
      setActiveContentTab("report");
      scrollToAfterRender(subtopicTitle);
    } else {
      // Already on report tab, scroll immediately
      const element = document.getElementById(subtopicTitle);

      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        // Use requestAnimationFrame for scroll offset to ensure smooth scroll completes
        requestAnimationFrame(() => {
          window.scrollBy({ top: NAVBAR_SCROLL_OFFSET, behavior: "auto" });
        });
      }
    }
  };

  // Handle keyboard activation for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCruxClick();
    }
  };

  return {
    handleCruxClick,
    handleSubtopicClick,
    handleKeyDown,
  };
}
