import React, { useContext } from "react";
import Icons from "@/assets/icons";
import { Button } from "@/components/elements";
import { Row } from "@/components/layout";
import { cn } from "@/lib/utils/shadcn";
import { ReportContext } from "../Report";

/**
 * Toolbar that follows down screen. Lets user do certain actions.
 * Buttons are hidden when on the Cruxes tab.
 */
export function ReportToolbar({
  setIsMobileOutlineOpen,
  isMobileOutlineOpen,
}: {
  setIsMobileOutlineOpen: (val: boolean) => void;
  isMobileOutlineOpen: boolean;
}) {
  const { dispatch, activeContentTab } = useContext(ReportContext);

  return (
    <Row
      // h-14 ensures consistent height with side column spacers when buttons are hidden
      // px-4 matches top-bar menu, sm:px-[44px] adds CardContent sm:p-8 (32px) for alignment
      className={`px-4 sm:px-[44px] py-2 h-14 justify-between w-full mx-auto`}
    >
      {/* Left side - mobile outline toggle */}
      <Row gap={2} className={cn(activeContentTab !== "report" && "hidden")}>
        <div>
          <Button
            onClick={() => setIsMobileOutlineOpen(!isMobileOutlineOpen)}
            className="sm:hidden p-3"
            variant={"outline"}
          >
            {isMobileOutlineOpen ? (
              <Icons.X2 className="fill-muted-foreground" />
            ) : (
              <Icons.MobileOutline className="size-4 fill-muted-foreground" />
            )}
          </Button>
        </div>
      </Row>

      {/* Right side - expand/collapse buttons */}
      <Row gap={2} className={cn(activeContentTab !== "report" && "hidden")}>
        {/* Close all button */}
        <Button
          onClick={() => dispatch({ type: "closeAll" })}
          variant={"outline"}
        >
          Collapse all
        </Button>
        {/* Open all button */}
        <Button
          onClick={() => dispatch({ type: "openAll" })}
          variant={"secondary"}
          data-testid={"open-all-button"}
        >
          Expand all
        </Button>
      </Row>
    </Row>
  );
}
