import { X } from "lucide-react";
import type React from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/elements";
import { Col } from "@/components/layout";
import type { getControversyCategory } from "@/lib/crux/utils";
import { ControversyTooltipContent } from "./ControversyTooltipContent";

interface ControversyDrawerProps {
  children: React.ReactNode;
  category: ReturnType<typeof getControversyCategory>;
  onClick?: () => void;
  className?: string;
}

/**
 * Mobile drawer version of the controversy indicator.
 *
 * Displays a bottom sheet drawer on mobile/touch devices, providing the same
 * controversy information as the desktop hover card but in a mobile-optimized format.
 * Uses Radix UI Drawer component for native-like sheet behavior.
 *
 * @param children - The visual indicator to display as the trigger (typically ControversyIcon)
 * @param category - Controversy category with level, label, and description
 * @param onClick - Optional callback when "View details" is clicked (e.g., navigate to cruxes tab)
 * @param className - Optional CSS classes to apply to the trigger element
 *
 * @features
 * - **Touch-optimized**: Bottom sheet drawer with swipe-to-dismiss
 * - **Accessible**: Explicit close button with screen reader support
 * - **Consistent content**: Uses ControversyTooltipContent for same messaging as desktop
 * - **Responsive**: Typically shown only on mobile (use `className="block sm:hidden"`)
 *
 * @example
 * ```tsx
 * <ControversyDrawer
 *   category={getControversyCategory(0.7)}
 *   onClick={() => setActiveTab('cruxes')}
 *   className="block sm:hidden"
 * >
 *   <ControversyIcon level="high" />
 * </ControversyDrawer>
 * ```
 */
export function ControversyDrawer({
  children,
  category,
  onClick,
  className,
}: ControversyDrawerProps) {
  return (
    <Drawer>
      <DrawerTrigger className={className}>{children}</DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="relative">
          <DrawerTitle>Controversy Level</DrawerTitle>
          <DrawerClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DrawerClose>
        </DrawerHeader>
        <Col className="px-4 pb-4">
          <ControversyTooltipContent category={category} onClick={onClick} />
        </Col>
      </DrawerContent>
    </Drawer>
  );
}
