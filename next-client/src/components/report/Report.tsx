import React from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { Col, Row } from "../layout";
import { CardContent, Separator, TextIcon } from "../elements";
import Icons from "@assets/icons";
import Theme from "../theme/Theme";

function Report({ reportData }: { reportData: schema.ReportDataObj }) {
  return (
    <div className="flex justify-center">
      <Col gap={4} className="max-w-4xl">
        <ReportHeader reportData={reportData} />
        {reportData.themes.map((theme) => (
          <Theme theme={theme} />
        ))}
      </Col>
    </div>
  );
}

export function ReportTitle({
  title,
  nClaims,
  nPeople,
  nThemes,
  nTopics,
  dateStr,
}: {
  title: string;
  nClaims: number;
  nTopics: number;
  nThemes: number;
  nPeople: number;
  dateStr: string;
}) {
  return (
    <Col gap={2} className="pb-1">
      <Row gap={2} className="justify-between">
        <h3>
          <a id={`${title}`}>{title}</a>
        </h3>
        <CopyLinkButton anchor={title} />
      </Row>
      <Row gap={4} className="h-5">
        <TextIcon icon={<Icons.Claim />}>{nClaims} claims</TextIcon>
        <TextIcon icon={<Icons.Topic />}>{nTopics} topics</TextIcon>
        <TextIcon icon={<Icons.Theme size={16} className="self-center" />}>
          {nThemes} themes
        </TextIcon>
        <Separator orientation="vertical" />
        <TextIcon icon={<Icons.People size={16} className="self-center" />}>
          {nPeople} people
        </TextIcon>
        <TextIcon icon={<Icons.Date size={16} className="self-center" />}>
          {dateStr}
        </TextIcon>
      </Row>
    </Col>
  );
}

export function ReportHeader({
  reportData,
}: {
  reportData: schema.ReportDataObj;
}) {
  const themes = reportData.themes;
  const topics = themes.flatMap((theme) => theme.topics);
  const claims = topics.flatMap((topic) => topic.claims);
  const dateStr = reportData.date.toDateString().split(" ").slice(1).join(" ");
  return (
    <CardContent>
      <Col gap={3}>
        <ReportTitle
          title={reportData.title}
          nThemes={themes.length}
          nTopics={topics.length}
          nClaims={claims.length}
          nPeople={0}
          dateStr={dateStr}
        />
        <p>{reportData.description}</p>
      </Col>
    </CardContent>
  );
}

export default Report;
