import Image from "next/image";
import Link from "next/link";
import Icons from "@/assets/icons";
import { Card } from "@/components/elements";
import { Col, Row } from "@/components/layout";
import { ContentGroup } from "./ContentGroup";

// Case studies data
const CASE_STUDIES = [
  {
    title: "Amplifying Youth Voices in Australia",
    imageUri: "/images/case-studies/australia.jpg",
    author: "AI Objectives Institute",
    url: "https://ai.objectives.institute/blog/talk-to-the-city-case-study-amplifying-youth-voices-in-australia",
  },
  {
    title: "Amplifying Voices: Talk to the City in Taiwan",
    imageUri: "/images/case-studies/taiwan.jpg",
    author: "AI Objectives Institute",
    url: "https://ai.objectives.institute/blog/amplifying-voices-talk-to-the-city-in-taiwan",
  },
  {
    title: "Using AI to Give People a Voice, a Case Study in Michigan",
    imageUri: "/images/case-studies/michigan.jpg",
    author: "AI Objectives Institute",
    url: "https://ai.objectives.institute/blog/using-ai-to-give-people-a-voice-a-case-study-in-michigan",
  },
];

const CaseStudyCard = ({
  title,
  imageUri,
  author,
  url,
}: {
  title: string;
  imageUri: string;
  author: string;
  url: string;
}) => (
  <Card className="w-full md:max-w-[260px] transition-transform duration-200 transform hover:opacity-90">
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Read case study: ${title}`}
    >
      <div className="w-full aspect-[1.5] md:max-w-[260px] md:max-h-[171px] relative">
        <Image
          src={imageUri}
          alt={`${title} cover image`}
          fill
          sizes="(max-width: 768px) 100vw, 260px"
          className="object-cover rounded-t-sm"
          loading="lazy"
        />
      </div>
      <Col gap={2} className="p-3">
        <p className="text-sm line-clamp-2">{title}</p>
        <p className="text-sm text-muted-foreground">{author}</p>
      </Col>
    </a>
  </Card>
);

export function Overview() {
  return (
    <ContentGroup>
      <h3 id="overview">Overview</h3>
      <p>
        Talk to the City (T3C) helps large groups of people coordinate by
        understanding each other better.
      </p>
      <p>
        It's an open-source tool for public consultation that solves the
        trade-off between depth and scale, using LLMs for comprehensive analysis
        of large response data. Whether you're soliciting general feedback from
        thousands of constituents, or untangling subtle details of a complex
        concern, T3C preserves the nuance of individual views while making sense
        of the collective conversation.
      </p>
      <p>
        Previous versions of Talk to the City have been used by the Taiwanese
        government and the Taiwan AI Assembly, unions, policy makers and more.
        See our{" "}
        <a href="#case-studies" className="underline">
          case studies
        </a>{" "}
        for more details.
      </p>
      <p>
        Built by the{" "}
        <a className="underline" href="https://ai.objectives.institute">
          AI Objectives Institute
        </a>
        . All code is{" "}
        <a
          className="underline"
          href="https://github.com/AIObjectives/tttc-light-js"
        >
          open-source on GitHub
        </a>
        .
      </p>
      <p>
        Have a question we didn't answer here, or interested in direct support
        in using Talk to the City? Reach out at{" "}
        <a className="underline" href="mailto:hello@aiobjectives.org">
          hello@aiobjectives.org
        </a>
        .
      </p>
    </ContentGroup>
  );
}

export function HowItWorks() {
  return (
    <ContentGroup>
      <h3 id="how-it-works">How it works?</h3>
      <p>
        We use Large Language Models (LLMs) to analyze broad themes from large
        datasets of free-text responses, summarize specific claims, and link
        those claims back to exact quotes. We use LLMs from OpenAI (default:
        gpt-4o-mini), and are adding more options later this year.
      </p>
      <p>
        We create an interactive report from the results, combining all scales
        of analysis, stored for you on the talktothe.city site. See examples in
        the{" "}
        <a href="#case-studies" className="underline">
          Case studies
        </a>{" "}
        section.
      </p>
      <p>
        This alpha version of T3C accepts input of any unstructured text,
        including free-form survey responses, interview and meeting transcripts,
        and collections of social media posts. We have experimental features to
        process audio and video datasets, and include video in reports &ndash;
        reach out if you're interested in using these features while they're
        under development.
      </p>
      <p>
        For this alpha launch, all reports are temporarily public to anyone who
        has the exact URL; we're adding password protection to reports soon.
      </p>
      <p>
        For detailed information on AI risks and our safety measures, see our{" "}
        <Link href="/safety" className="underline">
          LLM Safety guide
        </Link>
        .
      </p>
    </ContentGroup>
  );
}

export function DemoVideo() {
  return (
    <ContentGroup>
      <h3 id="demo-video">Demonstration video</h3>
      <Row gap={2} className="items-center">
        <Icons.Play
          className="stroke-foreground shrink-0 scale-x-[1.15]"
          size={24}
          aria-hidden="true"
        />
        <a
          className="underline"
          href="https://www.youtube.com/watch?v=DmkhGD_pK94"
          target="_blank"
          rel="noopener noreferrer"
        >
          Talk to the City Demo
        </a>
      </Row>
    </ContentGroup>
  );
}

export function CaseStudies() {
  return (
    <ContentGroup>
      <h3 id="case-studies">Case studies</h3>
      <Col gap={4} className="md:flex-row flex-wrap gap-x-4">
        {CASE_STUDIES.map((study) => (
          <CaseStudyCard key={study.title} {...study} />
        ))}
      </Col>
    </ContentGroup>
  );
}
