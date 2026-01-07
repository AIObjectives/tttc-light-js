"use client";
import Link from "next/link";
import type { ReportRef, ReportStatus } from "tttc-common/firebase";
import Icons from "@/assets/icons";
import { Badge, Card, CardContent, Separator, TextIcon } from "../elements";
import { Col, Row } from "../layout";

/**
 * Maps report status to badge variant and display label.
 * Uses subtle status variants with tinted backgrounds matching codebase patterns.
 * Legacy reports without status field default to no badge (assumed completed).
 */
function getStatusBadgeProps(status: ReportStatus | undefined): {
  variant: "status-warning" | "status-info" | "status-error";
  label: string;
} | null {
  switch (status) {
    case "created":
    case "queued":
      return { variant: "status-warning", label: "Queued" };
    case "processing":
      return { variant: "status-info", label: "Processing" };
    case "failed":
      return { variant: "status-error", label: "Failed" };
    case "cancelled":
      return { variant: "status-error", label: "Cancelled" };
    case "completed":
    case undefined:
      // Completed or legacy reports without status - don't show badge
      return null;
    default:
      // Exhaustive check - log unexpected values
      console.warn(`[my-reports] Unexpected report status: ${status}`);
      return null;
  }
}

const reportLink = (id: string) =>
  `${location.protocol}//${location.host}/report/${id}`;

interface MyReportsProps {
  reports: ReportRef[];
}

export default function MyReports({ reports }: MyReportsProps) {
  return (
    <Col gap={8} className="items-center">
      <YourReportsHeader />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[896px]">
        {reports.map((report) => (
          <ReportItem {...report} key={report.id} />
        ))}
      </div>
    </Col>
  );
}

function YourReportsHeader() {
  return (
    <Row gap={4} className="pt-8">
      <Col gap={2} className="justify-center">
        <h3>My reports</h3>
      </Col>
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
  status,
  numTopics,
  numSubtopics,
  numClaims,
  numPeople,
  createdDate,
}: ReportRef) => {
  const badgeProps = getStatusBadgeProps(status);

  return (
    <Col gap={2}>
      <Row className="justify-between">
        <Row gap={2} className="items-center min-w-0 flex-1">
          <h4 className="line-clamp-1">{title}</h4>
          {badgeProps && (
            <Badge variant={badgeProps.variant} className="shrink-0">
              {badgeProps.label}
            </Badge>
          )}
        </Row>
        <div className="self-center shrink-0">
          <Icons.ChevronRight className="w-6 h-6 stroke-muted-foreground" />
        </div>
      </Row>
      <Col gap={2} className="flex-wrap">
        <Row gap={4}>
          <TextIcon icon={<Icons.Theme size={16} />}>
            {numTopics} topics
          </TextIcon>
          <TextIcon icon={<Icons.Topic className="w-4 h-4" />}>
            {numSubtopics} subtopics
          </TextIcon>
          <TextIcon icon={<Icons.Claim className="w-4 h-4" />}>
            {numClaims} claims
          </TextIcon>
          <Separator orientation="vertical" className="bg-border w-[1px] h-5" />
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
};
