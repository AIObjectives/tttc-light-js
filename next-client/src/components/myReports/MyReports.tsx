"use client";
import { Check, ChevronsUpDown, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReportRef } from "tttc-common/firebase";
import Icons from "@/assets/icons";
import { cn } from "@/lib/utils/shadcn";
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  TextIcon,
} from "../elements";
import { Col, Row } from "../layout";

// Sort mode types and helpers
const SortModes = ["date-newest", "date-oldest", "title-asc", "title-desc"];
type MyReportsSortMode = (typeof SortModes)[number];

const defaultSortMode: MyReportsSortMode = "date-newest";

const MY_REPORTS_SORT_KEY = "myReportsSortPreference";

const isValidSortMode = (value: string): value is MyReportsSortMode =>
  SortModes.includes(value as MyReportsSortMode);

const getStoredSortMode = (): MyReportsSortMode => {
  if (typeof window === "undefined") return defaultSortMode;
  try {
    const stored = localStorage.getItem(MY_REPORTS_SORT_KEY);
    if (stored && isValidSortMode(stored)) return stored;
  } catch {
    // Ignore storage errors (SSR, private mode)
  }
  return defaultSortMode;
};

const setSortPreference = (mode: MyReportsSortMode) => {
  try {
    localStorage.setItem(MY_REPORTS_SORT_KEY, mode);
  } catch {
    // Ignore storage errors
  }
};

const getSortLabel = (mode: MyReportsSortMode): string => {
  const labels: Record<MyReportsSortMode, string> = {
    "date-newest": "Newest first",
    "date-oldest": "Oldest first",
    "title-asc": "Title A-Z",
    "title-desc": "Title Z-A",
  };
  return labels[mode];
};

const reportLink = (id: string) =>
  `${location.protocol}//${location.host}/report/${id}`;

interface MyReportsProps {
  reports: ReportRef[];
}

export default function MyReports({ reports }: MyReportsProps) {
  const [sortMode, setSortMode] = useState<MyReportsSortMode>("date-newest");

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    setSortMode(getStoredSortMode());
  }, []);

  const handleSortChange = (mode: MyReportsSortMode) => {
    setSortMode(mode);
    setSortPreference(mode);
  };

  const sortedReports = useMemo(() => {
    const sorted = [...reports];
    switch (sortMode) {
      case "date-newest":
        return sorted.sort(
          (a, b) => b.createdDate.getTime() - a.createdDate.getTime(),
        );
      case "date-oldest":
        return sorted.sort(
          (a, b) => a.createdDate.getTime() - b.createdDate.getTime(),
        );
      case "title-asc":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "title-desc":
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      default:
        return sorted;
    }
  }, [reports, sortMode]);

  return (
    <Col gap={8} className="items-center px-4">
      <YourReportsHeader sortMode={sortMode} onSortChange={handleSortChange} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[896px] w-full">
        {sortedReports.map((report) => (
          <ReportItem {...report} key={report.id} />
        ))}
      </div>
    </Col>
  );
}

interface YourReportsHeaderProps {
  sortMode: MyReportsSortMode;
  onSortChange: (mode: MyReportsSortMode) => void;
}

function YourReportsHeader({ sortMode, onSortChange }: YourReportsHeaderProps) {
  return (
    <Row
      gap={4}
      className="pt-8 w-full max-w-[896px] justify-between items-center"
    >
      <Col gap={2} className="justify-center">
        <h3>My reports</h3>
      </Col>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Sort reports: ${getSortLabel(sortMode)}`}
            >
              {getSortLabel(sortMode)}
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onSortChange("date-newest")}
              className={cn(
                "cursor-pointer",
                sortMode === "date-newest" && "bg-accent",
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  sortMode === "date-newest" ? "opacity-100" : "opacity-0",
                )}
              />
              Newest first
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange("date-oldest")}
              className={cn(
                "cursor-pointer",
                sortMode === "date-oldest" && "bg-accent",
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  sortMode === "date-oldest" ? "opacity-100" : "opacity-0",
                )}
              />
              Oldest first
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange("title-asc")}
              className={cn(
                "cursor-pointer",
                sortMode === "title-asc" && "bg-accent",
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  sortMode === "title-asc" ? "opacity-100" : "opacity-0",
                )}
              />
              Title A-Z
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange("title-desc")}
              className={cn(
                "cursor-pointer",
                sortMode === "title-desc" && "bg-accent",
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  sortMode === "title-desc" ? "opacity-100" : "opacity-0",
                )}
              />
              Title Z-A
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Row>
  );
}

export function ReportItem(props: ReportRef) {
  const { description, id } = props;

  return (
    <Card className="min-w-72 h-60 overflow-hidden">
      <Link href={reportLink(id)}>
        <CardContent>
          <Col gap={4}>
            <ReportItemTop {...props} />
            <p className="line-clamp-3">{description}</p>
          </Col>
        </CardContent>
      </Link>
    </Card>
  );
}

const ReportItemTop = ({
  title,
  numTopics,
  numSubtopics,
  numClaims,
  numPeople,
  createdDate,
  isPublic,
}: ReportRef) => (
  <Col gap={2}>
    <Row className="justify-between">
      <Row gap={2} className="items-center min-w-0">
        <VisibilityIndicator isPublic={isPublic} />
        <h4 className="line-clamp-1">{title}</h4>
      </Row>
      <div className="self-center shrink-0">
        <Icons.ChevronRight className="w-6 h-6 stroke-muted-foreground" />
      </div>
    </Row>
    <Col gap={2} className="flex-wrap">
      <Row gap={4}>
        <TextIcon icon={<Icons.Theme size={16} />}>{numTopics} topics</TextIcon>
        <TextIcon icon={<Icons.Topic className="w-4 h-4" />}>
          {numSubtopics} subtopics
        </TextIcon>
        <TextIcon icon={<Icons.Claim className="w-4 h-4" />}>
          {numClaims} claims
        </TextIcon>
        <Separator orientation="vertical" className="bg-border w-px h-5" />
      </Row>
      <Row gap={4}>
        <TextIcon icon={<Icons.People size={16} />}>
          {numPeople} people
        </TextIcon>
        <TextIcon icon={<Icons.Date size={16} />}>
          {createdDate.toDateString().split(" ").slice(1).join(" ")}
        </TextIcon>
      </Row>
    </Col>
  </Col>
);

/**
 * Visibility indicator showing lock (private) or globe (public) icon.
 * Legacy reports (isPublic === undefined) are shown as public since they're grandfathered.
 */
function VisibilityIndicator({ isPublic }: { isPublic: boolean | undefined }) {
  // undefined = legacy report (grandfathered as public), true = public, false = private
  const isPrivate = isPublic === false;
  const label = isPrivate
    ? "Private - only you can view"
    : "Shared - anyone with the link can view";

  return (
    <div className="shrink-0" role="img" aria-label={label} title={label}>
      {isPrivate ? (
        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      ) : (
        <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}
