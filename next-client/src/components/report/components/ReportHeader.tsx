import React, { useState } from "react";
import * as schema from "tttc-common/schema";
import { Col, Row } from "@/components/layout";
import {
  Button,
  CardContent,
  Separator,
  TextIcon,
  ToggleText,
} from "@/components/elements";
import Icons from "@/assets/icons";
import { getNPeople } from "tttc-common/morphisms";
import { useFocusedNode as _useFocusedNode } from "../hooks/useFocusedNode";
import { BarChart, BarChartItemType } from "@/components/barchart/Barchart";
import { CopyLinkButton } from "@/components/copyButton/CopyButton";

interface IReportTitle {
  title: string;
  nTopics: number;
  nSubtopics: number;
  nClaims: number;
  nPeople: number;
  dateStr: string;
}

/**
 * Header for Report that has some summary details.
 */
export function ReportHeader({
  topics,
  date,
  title,
  description,
  questionAnswers,
}: {
  topics: schema.Topic[];
  date: string;
  title: string;
  description: string;
  questionAnswers?: schema.QuestionAnswer[];
}) {
  const subtopics = topics.flatMap((topic) => topic.subtopics);
  const claims = subtopics.flatMap((subtopic) => subtopic.claims);
  const nPeople = getNPeople(claims);
  const dateStr = date;

  /**
   * Topic with the largest number of people
   */
  const largestSubtopic = topics
    .map((t) => getNPeople(t.subtopics))
    .sort((a, b) => a - b)
    .at(-1);

  /**
   * Each entry in the report level barchart
   */
  const barchartEntries: BarChartItemType[] = topics.map((topic) => {
    const nPeople = getNPeople(topic.subtopics);
    return {
      id: topic.id,
      title: topic.title,
      percentFill: nPeople / largestSubtopic!,
      subtitle: `${nPeople} people`,
      color: topic.topicColor,
    };
  });

  return (
    <CardContent>
      <Col gap={8}>
        {/* Contains title and basic overview stats */}
        <Col gap={1}>
          <ReportTitle
            title={title}
            nTopics={topics.length}
            nSubtopics={subtopics.length}
            nClaims={claims.length}
            nPeople={nPeople}
            dateStr={dateStr}
          />
          <ReportInfo />
        </Col>
        {/* Summary */}
        <ReportSummary
          description={description}
          questionAnswers={questionAnswers}
        />
        {/* Barchart */}
        <Col gap={3}>
          <h4>Overview</h4>
          <BarChart entries={barchartEntries} />
        </Col>
      </Col>
    </CardContent>
  );
}

/**
 * Inside header - has summary stats and title
 */
export function ReportTitle({
  title,
  nClaims,
  nPeople,
  nTopics,
  nSubtopics,
  dateStr,
}: IReportTitle) {
  return (
    <Col gap={2} className="pb-1">
      {/* Title and copy button */}
      <Row gap={2} className="justify-between">
        <h3>
          <a id={`${title}`}>{title}</a>
        </h3>
        <CopyLinkButton anchor={title} />
      </Row>

      {/* Stat details. Split into two parts for easy wrapping */}
      <Row gap={4} className="flex-wrap gap-y-1">
        {/* Number of topics */}
        <TextIcon icon={<Icons.Theme size={16} className="self-center" />}>
          {nTopics} topics
        </TextIcon>
        {/* Number of subtopics */}
        <TextIcon icon={<Icons.Topic />}>{nSubtopics} subtopics</TextIcon>
        {/* Number of claims */}
        <TextIcon icon={<Icons.Claim />}>{nClaims} claims</TextIcon>
        {/* Separator */}
        <Separator
          orientation="vertical"
          className="hidden sm:block h-4 self-center"
        />
        {/* Number of people */}
        <TextIcon icon={<Icons.People size={16} className="self-center" />}>
          {nPeople} people
        </TextIcon>
        {/* Date */}
        <TextIcon icon={<Icons.Date size={16} className="self-center" />}>
          {Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }).format(new Date(dateStr))}
        </TextIcon>
      </Row>
    </Col>
  );
}

/**
 * A dissmissable component telling the user about T3C
 */
export function ReportInfo() {
  const [show, setShow] = useState<boolean>(true);

  return (
    <Row
      gap={2}
      className={`p-4 border rounded items-center ${show ? "" : "hidden"}`}
    >
      <div>
        <Icons.Lightbulb />
      </div>
      <p className="p2 text-muted-foreground">
        Talk to the City takes the text from large group discussions and turns
        it into a summary report using AI prompting. Learn more on the About
        page.
      </p>
      <Button
        variant={"ghost"}
        size={"icon"}
        onClick={() => setShow(false)}
        className="h-10 w-10"
      >
        <div>
          <Icons.X />
        </div>
      </Button>
    </Row>
  );
}

/**
 * Summary section of the report
 *
 * Contains a summary written by the report creators, along with a Q&A section if present
 */
export function ReportSummary({
  description,
  questionAnswers,
}: {
  description: string;
  questionAnswers?: schema.QuestionAnswer[];
}) {
  return (
    <Col gap={3}>
      {/* Summary Title */}
      <Col gap={1}>
        <h4>Summary</h4>
        <Row
          gap={2}
          className="items-center text-muted-foreground fill-muted-foreground"
        >
          <div>
            <Icons.Info className="h-4 w-4" />
          </div>
          <p className="p2 text-muted-foreground flex gap-2 items-center ">
            The summary is written by the report creators, while the rest is
            AI-generated, excluding quotes.
          </p>
        </Row>
      </Col>
      {/* Summary Description */}
      <div>{description}</div>

      {/* Summary Meta Questions */}

      {questionAnswers?.map((qa) => (
        <ToggleText>
          <ToggleText.Title>{qa.question}</ToggleText.Title>
          <ToggleText.Content>{qa.answer}</ToggleText.Content>
        </ToggleText>
      ))}
    </Col>
  );
}
