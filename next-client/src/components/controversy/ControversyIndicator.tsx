"use client";

import React from "react";
import { Row } from "@/components/layout";
import { ControversyIcon } from "@/assets/icons/ControversyIcons";
import { getControversyCategory } from "@/lib/crux/utils";
import { InteractiveControversy } from "./InteractiveControversy";
import { ControversyDrawer } from "./ControversyDrawer";

interface ControversyIndicatorProps {
  /** Controversy score from 0-1 */
  score: number;
  /** Optional click handler (e.g., navigate to cruxes tab) */
  onClick?: () => void;
  /** Show the label text next to the icon */
  showLabel?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Displays a controversy indicator with icon and optional label.
 *
 * Desktop: Hover card with click-to-pin functionality
 * Mobile: Bottom sheet drawer
 *
 * Features:
 * - Responsive behavior (hover card on desktop, drawer on mobile)
 * - Keyboard accessible (Escape to close)
 * - Optional navigation to cruxes tab
 */
export function ControversyIndicator({
  score,
  onClick,
  showLabel = true,
  className,
}: ControversyIndicatorProps) {
  const category = getControversyCategory(score);

  const content = (
    <Row gap={1} className={`items-center ${className ?? ""}`}>
      <ControversyIcon level={category.level} size={16} />
      {showLabel && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {category.label} controversy
        </span>
      )}
    </Row>
  );

  return (
    <>
      <InteractiveControversy
        category={category}
        onClick={onClick}
        className="hidden sm:block"
      >
        {content}
      </InteractiveControversy>
      <ControversyDrawer
        category={category}
        onClick={onClick}
        className="block sm:hidden"
      >
        {content}
      </ControversyDrawer>
    </>
  );
}

export default ControversyIndicator;
