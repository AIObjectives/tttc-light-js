import React, { useContext } from "react";
import { Row } from "@/components/layout";
import { Button } from "@/components/elements";
import Icons from "@/assets/icons";
import { useFocusedNode as _useFocusedNode } from "../hooks/useFocusedNode";
import { ReportContext } from "../Report";
/**
 * Bar that follows down screen. Lets user do certain actions.
 */
export function ReportToolbar({
  setIsMobileOutlineOpen,
  isMobileOutlineOpen,
}: {
  setIsMobileOutlineOpen: (val: boolean) => void;
  isMobileOutlineOpen: boolean;
}) {
  const { dispatch } = useContext(ReportContext);
  return (
    // Sticky keeps it at top of screen when scrolling down.

    <Row
      // ! make sure this is the same width as the theme cards.
      className={`p-2 justify-between w-full mx-auto`}
    >
      <Row gap={2}>
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
        {/* <div>
          <Button variant={"outline"}>Edit</Button>
        </div> */}
      </Row>
      <Row gap={2}>
        {/* Close all button */}
        <Button
          onClick={() => dispatch({ type: "closeAll" })}
          variant={"outline"}
        >
          Collapse all
        </Button>
        {/* Open all button  */}
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
