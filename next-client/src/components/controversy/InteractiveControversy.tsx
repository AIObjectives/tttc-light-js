import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
} from "@/components/elements";
import { getControversyCategory } from "@/lib/crux/utils";
import { ControversyTooltipContent } from "./ControversyTooltipContent";

interface InteractiveControversyProps {
  children: React.ReactNode;
  category: ReturnType<typeof getControversyCategory>;
  onClick?: () => void;
  className?: string;
}

/**
 * Desktop hover card version of the controversy indicator.
 *
 * Displays a controversy indicator with interactive tooltip that can be
 * pinned open for easier reading or navigation.
 *
 * @param children - The visual indicator to display (typically ControversyIcon)
 * @param category - Controversy category with level, label, and description
 * @param onClick - Optional callback when clicked (e.g., navigate to cruxes tab).
 *                  If provided, clicking triggers callback instead of pinning tooltip.
 * @param className - Optional CSS classes to apply to the trigger element
 *
 * @interaction
 * - **Hover**: Tooltip appears on hover, disappears on mouse leave
 * - **Click**: Pins tooltip open (stays visible until dismissed)
 * - **Click Outside**: Unpins and closes tooltip
 * - **Escape Key**: Unpins and closes tooltip
 *
 * @example
 * ```tsx
 * <InteractiveControversy
 *   category={getControversyCategory(0.8)}
 *   onClick={() => setActiveTab('cruxes')}
 * >
 *   <ControversyIcon level="high" />
 * </InteractiveControversy>
 * ```
 */
export function InteractiveControversy({
  children,
  category,
  onClick,
  className,
}: InteractiveControversyProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      setIsPinned(true);
      setIsOpen(true);
    }
  }, [onClick]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Activate on Enter or Space key
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); // Prevent scrolling on Space
        handleClick();
      }
    },
    [handleClick],
  );

  // Use refs for event handlers to avoid stale closures and ensure stable references
  // for addEventListener/removeEventListener pairing
  const handleOutsideClickRef = useRef<(event: MouseEvent) => void>(() => {});
  const handleEscapeKeyRef = useRef<(event: KeyboardEvent) => void>(() => {});

  // Update refs with latest handler implementations
  handleOutsideClickRef.current = (event: MouseEvent) => {
    const target = event.target as Node;
    // Add null checks before calling .contains()
    const isOutsideTrigger =
      !triggerRef.current || !triggerRef.current.contains(target);
    const isOutsideContent =
      !contentRef.current || !contentRef.current.contains(target);

    if (isOutsideTrigger && isOutsideContent) {
      setIsPinned(false);
      setIsOpen(false);
    }
  };

  handleEscapeKeyRef.current = (event: KeyboardEvent) => {
    // Only handle if THIS instance is pinned
    if (event.key === "Escape" && isPinned) {
      event.stopPropagation(); // Prevent bubbling to other handlers
      setIsPinned(false);
      setIsOpen(false);
    }
  };

  // Effect to manage event listeners with stable references
  useEffect(() => {
    if (!isPinned) return;

    // Create stable wrapper functions that delegate to refs
    const outsideClickHandler = (e: MouseEvent) =>
      handleOutsideClickRef.current(e);
    const escapeHandler = (e: KeyboardEvent) => handleEscapeKeyRef.current(e);

    document.addEventListener("mousedown", outsideClickHandler);
    document.addEventListener("keydown", escapeHandler);
    return () => {
      document.removeEventListener("mousedown", outsideClickHandler);
      document.removeEventListener("keydown", escapeHandler);
    };
  }, [isPinned]); // Only isPinned in deps - refs provide stable handler access

  return (
    <HoverCard
      openDelay={0}
      closeDelay={0}
      open={isOpen}
      onOpenChange={(open) => {
        if (!isPinned) {
          setIsOpen(open);
        }
      }}
    >
      <HoverCardTrigger asChild className={className}>
        <div
          ref={triggerRef}
          className="cursor-pointer"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`${category.label} controversy indicator`}
        >
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          ref={contentRef}
          sideOffset={5}
          side="top"
          className="w-64"
        >
          <ControversyTooltipContent category={category} onClick={onClick} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}
