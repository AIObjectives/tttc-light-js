"use client";
import React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  Separator,
  TextIcon,
} from "../elements";
import { Col, Row } from "../layout";
import Icons from "@src/assets/icons";
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
      <YourReportsHeader
        name={userName}
        description={undefined}
        pictureUri="https://imgflip.com/s/meme/Unsettled-Tom.jpg"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[896px]">
        {reports.map((reportdata) => (
          <ReportItem {...reportdata} />
        ))}
      </div>
    </Col>
  );
}

function YourReportsHeader({
  name,
  description,
  pictureUri,
}: {
  name: string;
  description: string | undefined;
  pictureUri: string;
}) {
  return (
    <Row gap={4} className="p-8">
      <Avatar className="h-32 w-32">
        <AvatarImage className="flex-shrink-0 object-fill" src={pictureUri} />
        <AvatarFallback>YOU</AvatarFallback>
      </Avatar>
      <Col gap={2} className="justify-center">
        <h3>{name}</h3>
        {description && <p>{description}</p>}
      </Col>
    </Row>
  );
}

export function ReportItem(props: ReportRef) {
  const { description, reportDataUri } = props;
  return (
    <Card className="min-w-72">
      <CardContent>
        <Col gap={4}>
          <ReportItemTop {...props} />
          <p className="line-clamp-4">{description}</p>
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
