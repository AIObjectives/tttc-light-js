import React from "react";
import { Col, Row } from "@/components/layout";
import { Sheet, SheetContent, SheetTitle } from "@/components/elements";
import { Sticky } from "@/components/wrappers";
import { cn } from "@/lib/utils/shadcn";

/**
 * Frame that wraps the toolbar.
 * When the user scrolls down, it enters sticky mode and floats above the rest of the content.
 */
export const ToolBarFrame = ({
  children,
  className,
  stickyClass,
}: React.PropsWithChildren<{ className?: string; stickyClass?: string }>) => (
  <Sticky
    className={cn(
      `z-[70] w-full dark:bg-background bg-white pointer-events-auto`,
      className,
    )}
    stickyClass={cn("border-b shadow-sm pointer-events-auto", stickyClass)}
  >
    {children}
  </Sticky>
);

/**
 * The report page is divided into three sections:
 * - The outline (to the left)
 * - The main report body (center)
 * - A blank space to the right for balance
 *
 * The outline is hidden when on the Cruxes tab.
 */
export function ReportLayout({
  Outline,
  Report,
  ToolBar,
  isMobileOutlineOpen,
  setIsMobileOutlineOpen,
  navbarState,
  activeContentTab,
}: {
  Outline: React.ReactNode;
  Report: React.ReactNode;
  ToolBar: React.ReactNode;
  isMobileOutlineOpen: boolean;
  setIsMobileOutlineOpen: (val: boolean) => void;
  navbarState: { isVisible: boolean; height: number };
  activeContentTab: "report" | "cruxes";
}) {
  const showOutline = activeContentTab === "report";

  return (
    <Row className="flex w-full min-h-screen">
      {/* Outline section - keep column for layout but hide content on cruxes tab */}
      <Col className="hidden md:block min-w-[279px] basis-0 flex-grow">
        <ToolBarFrame className="opacity-0" stickyClass="opacity-100">
          <div className="w-full h-14" />
        </ToolBarFrame>
        <div
          className={cn(
            "sticky top-20",
            !showOutline && "opacity-0 pointer-events-none",
          )}
        >
          {Outline}
        </div>
      </Col>

      {/* Mobile outline sheet - only show on report tab */}
      {showOutline && (
        <Sheet open={isMobileOutlineOpen} onOpenChange={setIsMobileOutlineOpen}>
          <SheetContent side={"left"} className="px-0 pt-0 top-0 max-w-[280px]">
            <div
              className="border-t border-l border-slate-200 h-[calc(100vh-theme(spacing.14))] transition-all duration-200 pt-4 pr-2"
              style={{
                marginTop: navbarState.isVisible
                  ? `${navbarState.height + 56}px`
                  : "56px", // 56px is toolbar height (h-14)
                height: navbarState.isVisible
                  ? `calc(100vh - ${navbarState.height + 56}px)`
                  : "calc(100vh - 56px)",
              }}
            >
              {/* Sheet title here is a requirement for visually impaired users. Won't show up visually. */}
              <SheetTitle className="sr-only">Outline</SheetTitle>
              {Outline}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Body section */}
      <Col className="flex-grow max-w-[896px] mx-auto w-full">
        <ToolBarFrame>{ToolBar}</ToolBarFrame>
        {Report}
      </Col>

      {/* Right section - spacer for balanced layout */}
      <Col className="min-w-[279px] basis-0 flex-grow hidden sm:block">
        <ToolBarFrame className="opacity-0" stickyClass="opacity-100">
          <div className="w-full h-14" />
        </ToolBarFrame>
      </Col>
    </Row>
  );
}
