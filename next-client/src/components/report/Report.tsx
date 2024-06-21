import React from "react";
import * as schema from "tttc-common/schema";
import CopyLinkButton from "../copyLinkButton/CopyLinkButton";
import { Col, Row } from "../layout";
import { CardContent, Separator, TextIcon } from "../elements";
import Icons from "@assets/icons";
import ReportStateManager from "./components/ReportStateManager";
import { getNPeople } from "tttc-common/morphisms";

function Report({ reportData }: { reportData: schema.ReportDataObj }) {
  return (
    <ReportStateManager themes={reportData.themes}>
      <ReportHeader reportData={reportData} />
    </ReportStateManager>
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
        <TextIcon icon={<Icons.Theme size={16} className="self-center" />}>
          {nThemes} themes
        </TextIcon>
        <TextIcon icon={<Icons.Topic />}>{nTopics} topics</TextIcon>
        <TextIcon icon={<Icons.Claim />}>{nClaims} claims</TextIcon>
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
  const nPeople = getNPeople(claims);
  const dateStr = reportData.date;
  return (
    <CardContent>
      <Col gap={3}>
        <ReportTitle
          title={reportData.title}
          nThemes={themes.length}
          nTopics={topics.length}
          nClaims={claims.length}
          nPeople={nPeople}
          dateStr={dateStr}
        />
        <p>{reportData.description}</p>
      </Col>
    </CardContent>
  );
}

export default Report;
