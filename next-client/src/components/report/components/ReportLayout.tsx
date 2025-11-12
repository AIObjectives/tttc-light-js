import React from "react";
import { Col, Row } from "@/components/layout";
import { Sheet, SheetContent, SheetTitle } from "@/components/elements";
import { Sticky } from "@/components/wrappers";
import { cn } from "@/lib/utils/shadcn";
import { useFocusedNode as _useFocusedNode } from "../hooks/useFocusedNode";

/**
 * The report page is roughly divided into three sections:
 *
 * The main report body
 *
 * The outline (to the left)
 *
 * and a blank space to the right to maintain balance
 *
 * The component takes the three sections as props and arranges them
 */
export function ReportLayout({
  Outline,
  Report,
  ToolBar,
  isMobileOutlineOpen,
  setIsMobileOutlineOpen,
  navbarState,
}: {
  Outline: React.ReactNode;
  Report: React.ReactNode;
  ToolBar: React.ReactNode;
  isMobileOutlineOpen: boolean;
  setIsMobileOutlineOpen: (val: boolean) => void;
  navbarState: { isVisible: boolean; height: number };
}) {
  return (
    <Row className="flex w-full min-h-screen">
      {/* Outline section (non-mobile) */}
      <Col className="hidden md:block min-w-[279px] flex-grow">
        {/* Empty toolbar frame added here to make the illusion of a solid bar across the page */}
        <ToolBarFrame className="opacity-0" stickyClass="opacity-100">
          <div className="w-full h-14" />
        </ToolBarFrame>
        <div className="sticky top-20">{Outline}</div>
      </Col>

      {/* Outline section (mobile) */}
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

      {/* Body section */}
      <Col className="flex-grow max-w-[896px] mx-auto w-full">
        <ToolBarFrame>{ToolBar}</ToolBarFrame>
        {Report}
      </Col>

      {/* Right section */}
      <Col className="flex-grow hidden sm:block">
        {/* Empty toolbar frame added here to make the illusion of a solid bar across the page */}
        <ToolBarFrame className="opacity-0" stickyClass="opacity-100">
          <div className="w-full h-14" />
        </ToolBarFrame>
      </Col>
    </Row>
  );
}

/**
 * This is a frame that wraps our tool bar
 *
 * When the user scrolls down, it should enter its sticky mode and float above the rest of the content
 */
const ToolBarFrame = ({
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
