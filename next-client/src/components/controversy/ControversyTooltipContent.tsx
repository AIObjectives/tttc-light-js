import { ControversyIcon } from "@/assets/icons/ControversyIcons";
import { Col, Row } from "@/components/layout";
import type { getControversyCategory } from "@/lib/crux/utils";

interface ControversyTooltipContentProps {
  category: ReturnType<typeof getControversyCategory>;
  onClick?: () => void;
}

/**
 * Content shown in both hover card and drawer for controversy indicators.
 *
 * Displays the controversy level icon, label, description, and optional
 * "View details" link if onClick is provided. This component is used by both
 * InteractiveControversy (desktop hover card) and ControversyDrawer (mobile drawer)
 * to ensure consistent messaging across devices.
 *
 * @param category - Controversy category with level, label, and description
 * @param onClick - Optional callback when "View details" is clicked (e.g., navigate to cruxes tab).
 *                  If not provided, no action button is shown.
 *
 * @example
 * ```tsx
 * // With navigation callback
 * <ControversyTooltipContent
 *   category={getControversyCategory(0.8)}
 *   onClick={() => setActiveTab('cruxes')}
 * />
 *
 * // Without navigation (informational only)
 * <ControversyTooltipContent
 *   category={getControversyCategory(0.3)}
 * />
 * ```
 */
export function ControversyTooltipContent({
  category,
  onClick,
}: ControversyTooltipContentProps) {
  return (
    <Col gap={2}>
      <Row gap={2} className="items-center text-muted-foreground">
        <ControversyIcon level={category.level} size={20} />
        <span className="font-medium">{category.label} controversy</span>
      </Row>
      <p className="text-sm text-muted-foreground">{category.description}</p>
      {onClick && (
        <button
          onClick={onClick}
          className="text-sm text-primary hover:underline text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          View details in Cruxes tab
        </button>
      )}
    </Col>
  );
}
