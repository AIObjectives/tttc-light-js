import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/shadcn";
import { useReportUIStore, useSortMode } from "@/stores/reportUIStore";
import type { SortMode } from "@/stores/types";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../elements";

interface SortDropdownProps {
  hasControversyData: boolean;
  hasBridgingData: boolean;
}

/**
 * Dropdown for selecting sort mode (frequent, controversy, bridging).
 * Only shown when relevant sort features are available.
 */
export function SortDropdown({
  hasControversyData,
  hasBridgingData,
}: SortDropdownProps) {
  const sortMode = useSortMode();
  const setSortMode = useReportUIStore((s) => s.setSortMode);

  const getSortLabel = (mode: SortMode): string => {
    switch (mode) {
      case "controversy":
        return "Controversy";
      case "bridging":
        return "Bridging statements";
      default:
        return "Frequent claims";
    }
  };

  return (
    <div className="flex items-center gap-2 ml-auto">
      <span className="text-sm text-muted-foreground">Sort by</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {getSortLabel(sortMode)}
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setSortMode("frequent")}
            className={cn(
              "cursor-pointer",
              sortMode === "frequent" && "bg-accent",
            )}
          >
            Frequent claims
          </DropdownMenuItem>
          {hasControversyData && (
            <DropdownMenuItem
              onClick={() => setSortMode("controversy")}
              className={cn(
                "cursor-pointer",
                sortMode === "controversy" && "bg-accent",
              )}
            >
              Controversy
            </DropdownMenuItem>
          )}
          {hasBridgingData && (
            <DropdownMenuItem
              onClick={() => setSortMode("bridging")}
              className={cn(
                "cursor-pointer",
                sortMode === "bridging" && "bg-accent",
              )}
            >
              Bridging statements
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
