"use client";
import React from "react";
import { Card, CardContent, Separator, TextIcon } from "../elements";
import { Col, Row } from "../layout";
import Icons from "@/assets/icons";
import { ReportRef } from "tttc-common/firebase";
import Link from "next/link";

const reportLink = (uri: string) =>
  location.protocol +
  "//" +
  location.host +
  `/report/${encodeURIComponent(uri)}`;

interface MyReportsProps {
  reports: ReportRef[];
}

export default function MyReports({ reports }: MyReportsProps) {
  return (
    <Col gap={8}>
      <YourReportsHeader />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[896px]">
        {reports.map((reportdata) => (
          <ReportItem {...reportdata} key={reportdata.reportDataUri} />
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
  const { description, reportDataUri } = props;
  return (
    <Card className="min-w-72 h-60">
      <Link href={reportLink(reportDataUri)}>
        <CardContent>
          <Col gap={4}>
            <ReportItemTop {...props} />
            <p className="line-clamp-4">{description}</p>
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
  reportDataUri,
}: ReportRef) => (
  <Col gap={2}>
    <Row className="justify-between">
      <h4>{title}</h4>
      <div className="self-center">
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
