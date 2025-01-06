"use client";
import React from "react";
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Separator,
  TextIcon,
} from "../elements";
import { Col, Row } from "../layout";
import Icons from "@src/assets/icons";
import Link from "next/link";
import CopyButton from "../copyButton/CopyButton";
import { ReportRef } from "tttc-common/firebase";

const reportLink = (uri: string) =>
  location.protocol +
  "//" +
  location.host +
  `/report/${encodeURIComponent(uri)}`;

export default function YourReports({
  userName,
  reports,
}: {
  userName: string;
  reports: ReportRef[];
}) {
  return (
    <Col gap={4}>
      <div className="px-8 pt-8 pb-5">
        <h3>{userName}</h3>
      </div>
      {reports.map((reportdata) => (
        <ReportItem {...reportdata} />
      ))}
    </Col>
  );
}

export function ReportItem(props: ReportRef) {
  const { description, reportDataUri } = props;
  return (
    <Card className="max-w-[896px] w-full">
      <CardContent>
        <Col gap={3}>
          <ReportItemTop {...props} />
          <p>{description}</p>
          <Link href={reportLink(reportDataUri)} className="self-end">
            <Button>Open report</Button>
          </Link>
        </Col>
      </CardContent>
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
      <CardTitle>{title}</CardTitle>
      <CopyButton
        successMessage="Link copied"
        copyStr={reportLink(reportDataUri)}
      />
    </Row>
    <Row gap={4}>
      <Row gap={4}>
        <TextIcon icon={<Icons.Theme size={16} />}>{numTopics} topics</TextIcon>
        <TextIcon icon={<Icons.Topic className="w-4 h-4" />}>
          {numSubtopics} subtopics
        </TextIcon>
        <TextIcon icon={<Icons.Claim className="w-4 h-4" />}>
          {numClaims} claims
        </TextIcon>
        <Separator orientation="vertical" className="hidden sm:block" />
      </Row>
      <Row gap={4}>
        <TextIcon icon={<Icons.People size={16} />}>
          {numPeople} people
        </TextIcon>
        <TextIcon icon={<Icons.Date size={16} />}>
          {createdDate.toDateString().split(" ").slice(1).join(" ")}
        </TextIcon>
      </Row>
    </Row>
  </Col>
);
