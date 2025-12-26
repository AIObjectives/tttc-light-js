import { useState } from "react";
import {
  getNPeopleFromClaims,
  getNPeopleFromSubtopics,
} from "tttc-common/morphisms";
import type * as schema from "tttc-common/schema";
import Icons from "@/assets/icons";
import {
  BarChart,
  type BarChartItemType,
} from "@/components/barchart/Barchart";
import { CopyLinkButton } from "@/components/copyButton/CopyButton";
import {
  Button,
  CardContent,
  Separator,
  TextIcon,
  ToggleText,
} from "@/components/elements";
import { Col, Row } from "@/components/layout";

interface IReportTitle {
  title: string;
  nClaims: number;
  nTopics: number;
  nThemes: number;
  nPeople: number;
  dateStr: string;
}

/**
 * Header for Report that has some summary details.
 */
export function ReportHeader({
  topics: themes,
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
  const topics = themes.flatMap((theme) => theme.subtopics);
  const claims = topics.flatMap((topic) => topic.claims);
  const nPeople = getNPeopleFromClaims(claims);
  const dateStr = date;
  return (
    <CardContent className="print:pb-0" data-report-header>
      <Col gap={8} className="print:gap-2">
        {/* Contains title and basic overview stats */}
        <ReportIntro
          title={title}
          nThemes={themes.length}
          nTopics={topics.length}
          nClaims={claims.length}
          nPeople={nPeople}
          dateStr={dateStr}
        />
        {/* Summary */}
        <ReportSummary
          description={description}
          questionAnswers={questionAnswers}
        />
        {/* Overview - hide from print */}
        <div className="print:hidden">
          <ReportOverview topics={themes} />
        </div>
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
  nThemes,
  nTopics,
  dateStr,
}: IReportTitle) {
  return (
    <Col gap={2} className="pb-1">
      {/* Title and copy button */}
      <Row gap={2} className="justify-between">
        <h3 id={`${title}`} className="print-report-title">
          {title}
        </h3>
        <CopyLinkButton anchor={title} />
      </Row>

      {/* Stat details. Split into two parts for easy wrapping */}
      <Row gap={4} className="flex-wrap gap-y-1">
        {/* Number of topics */}
        <TextIcon icon={<Icons.Theme size={16} className="self-center" />}>
          {nThemes} topics
        </TextIcon>
        {/* Number of subtopics */}
        <TextIcon icon={<Icons.Topic />}>{nTopics} subtopics</TextIcon>
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
 * Title and info banner combined
 */
export function ReportIntro(props: IReportTitle) {
  return (
    <Col gap={1}>
      <ReportTitle {...props} />
      <ReportInfo />
    </Col>
  );
}

/**
 * A dismissable component telling the user about T3C
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
        Talk to the City uses AI to turn the text from large group discussions
        into summary reports. Most of the text is AI generated, except for the
        summary from hosts and the quotes from participants.
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
 * Summary section of the report.
 * Contains a summary written by the report creators, along with a Q&A section if present.
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
      <h4>Summary</h4>
      {/* Summary Description */}
      <div className="print:text-xs">{description}</div>

      {/* Summary Meta Questions */}
      {questionAnswers?.map((qa, index) => (
        <ToggleText key={`qa-${index}-${qa.question.slice(0, 20)}`}>
          <ToggleText.Title>{qa.question}</ToggleText.Title>
          <ToggleText.Content>{qa.answer}</ToggleText.Content>
        </ToggleText>
      ))}
    </Col>
  );
}

/**
 * Overview bar chart showing topic distribution
 */
export function ReportOverview({ topics }: { topics: schema.Topic[] }) {
  const getBarChartEntries = (topics: schema.Topic[]): BarChartItemType[] => {
    const largestN = topics.reduce((accum, curr) => {
      const nClaims = getNPeopleFromSubtopics(curr.subtopics);
      return Math.max(nClaims, accum);
    }, 0);

    return topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      percentFill: getNPeopleFromSubtopics(topic.subtopics) / largestN,
      subtitle: `${getNPeopleFromSubtopics(topic.subtopics)} people`,
      color: topic.topicColor,
    }));
  };

  return (
    <Col gap={3}>
      <h4>Overview</h4>
      <div className="print:hidden">
        <BarChart entries={getBarChartEntries(topics)} />
      </div>
      <div className="hidden print:block" data-print-overview="true">
        <Col gap={3}>
          {topics.map((topic) => (
            <div key={topic.id} className="mb-2">
              <p className="font-semibold print-overview-topic">
                {topic.title}
              </p>
              <p className="text-muted-foreground ml-4 mt-1 print-overview-subtopic">
                {topic.subtopics.map((sub, idx) => (
                  <span key={sub.id}>
                    {sub.title}
                    {idx < topic.subtopics.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </Col>
      </div>
    </Col>
  );
}
