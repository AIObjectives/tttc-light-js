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

type ReportItemData = {
  reportLink: string;
  title: string;
  description: string;
  numTopics: number;
  numSubtopics: number;
  numClaims: number;
  numPeople: number;
  createdDate: string;
};

export default function YourReports({
  userName,
  reports,
}: {
  userName: string;
  reports: ReportItemData[];
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

export function ReportItem(props: ReportItemData) {
  const { description, reportLink } = props;
  return (
    <Card className="max-w-[896px] w-full">
      <CardContent>
        <Col gap={3}>
          <ReportItemTop {...props} />
          <p>{description}</p>
          <Link href={reportLink} className="self-end">
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
  reportLink,
}: ReportItemData) => (
  <Col gap={2}>
    <Row className="justify-between">
      <CardTitle>{title}</CardTitle>
      <CopyButton successMessage="Link copied" copyStr={reportLink} />
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
        <TextIcon icon={<Icons.Date size={16} />}>{createdDate}</TextIcon>
      </Row>
    </Row>
  </Col>
);
