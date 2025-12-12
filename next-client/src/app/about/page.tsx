import Icons from "@/assets/icons";
import { Col, Row } from "@/components/layout";
import { Card } from "@/components/elements";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";
import Link from "next/link";
import Image from "next/image";
import React from "react";

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

// Case study card component (pattern from Landing.tsx)
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

const ContentGroup = ({ children }: React.PropsWithChildren) => (
  <Col gap={3}>{children}</Col>
);

const ContentGroupContainer = ({ children }: React.PropsWithChildren) => (
  <Col gap={6}>{children}</Col>
);

const Outline = () => (
  <Col gap={2}>
    <Row gap={1} className="items-center">
      <Icons.Outline className="stroke-muted-foreground" size={16} />
      <p className="text-muted-foreground text-sm tracking-wide">Outline</p>
    </Row>
    <ul className="text-muted-foreground text-sm leading-5 pl-2 space-y-2">
      <li>
        – <a href="#overview">Overview</a>
      </li>
      <li>
        – <a href="#how-it-works">How it works</a>
      </li>
      <li>
        – <a href="#demo-video">Demonstration video</a>
      </li>
      <li>
        – <a href="#case-studies">Case studies</a>
      </li>
      <li>
        – <a href="#faq">FAQ</a>
      </li>
      <li>
        – <a href="#tutorial">Report creation FAQ</a>
      </li>
      <li>
        – <a href="#privacy-security">Privacy & security</a>
      </li>
    </ul>
  </Col>
);

export default async function AboutPage() {
  const analytics = await serverSideAnalyticsClient();
  await analytics.page("About");
  return (
    <Col className="p-4 sm:p-8 max-w-[896px] m-auto">
      <ContentGroupContainer>
        {/* Header with title and outline */}
        <ContentGroup>
          <h2>About</h2>
          <Outline />
        </ContentGroup>

        {/* Overview section */}
        <ContentGroup>
          <h3 id="overview">Overview</h3>
          <p>
            Talk to the City (T3C) helps large groups of people coordinate by
            understanding each other better.
          </p>
          <p>
            It's an open-source tool for public consultation that solves the
            trade-off between depth and scale, using LLMs for comprehensive
            analysis of large response data. Whether you're soliciting general
            feedback from thousands of constituents, or untangling subtle
            details of a complex concern, T3C preserves the nuance of individual
            views while making sense of the collective conversation.
          </p>
          <p>
            Previous versions of Talk to the City have been used by the
            Taiwanese government and the Taiwan AI Assembly, unions, policy
            makers and more. See our{" "}
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
            Have a question we didn't answer here, or interested in direct
            support in using Talk to the City? Reach out at{" "}
            <a className="underline" href="mailto:hello@aiobjectives.org">
              hello@aiobjectives.org
            </a>
            .
          </p>
        </ContentGroup>
        {/* How it works section */}
        <ContentGroup>
          <h3 id="how-it-works">How it works?</h3>
          <p>
            We use Large Language Models (LLMs) to analyze broad themes from
            large datasets of free-text responses, summarize specific claims,
            and link those claims back to exact quotes. We use LLMs from OpenAI
            (default: gpt-4o-mini), and are adding more options later this year.
          </p>
          <p>
            We create an interactive report from the results, combining all
            scales of analysis, stored for you on the talktothe.city site. See
            examples in the{" "}
            <a href="#case-studies" className="underline">
              Case studies
            </a>{" "}
            section.
          </p>
          <p>
            This alpha version of T3C accepts input of any unstructured text,
            including free-form survey responses, interview and meeting
            transcripts, and collections of social media posts. We have
            experimental features to process audio and video datasets, and
            include video in reports &ndash; reach out if you're interested in
            using these features while they're under development.
          </p>
          <p>
            For this alpha launch, all reports are temporarily public to anyone
            who has the exact URL; we're adding password protection to reports
            soon.
          </p>
          <p>
            For detailed information on AI risks and our safety measures, see
            our{" "}
            <Link href="/safety" className="underline">
              LLM Safety guide
            </Link>
            .
          </p>
        </ContentGroup>

        {/* Demonstration video section */}
        <ContentGroup>
          <h3 id="demo-video">Demonstration video</h3>
          <Row gap={2} className="items-center">
            <Icons.Play
              className="stroke-foreground flex-shrink-0 scale-x-[1.15]"
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

        {/* Case studies section */}
        <ContentGroup>
          <h3 id="case-studies">Case studies</h3>
          <Col gap={4} className="md:flex-row flex-wrap gap-x-4">
            {CASE_STUDIES.map((study) => (
              <CaseStudyCard key={study.title} {...study} />
            ))}
          </Col>
        </ContentGroup>

        <ContentGroup>
          <h3 id="faq">FAQ</h3>

          <h5>What data format does the CSV file need to follow?</h5>
          <ul className="list-disc list-inside pl-2">
            <li>
              Required column: "comment" (contains the text of the responses to
              analyze with T3C)
            </li>
            <li>
              Optional column: "interview" (respondent name, which can be a
              pseudonym, or blank for anonymous speakers)
            </li>
            <li>
              Optional column: "id" (for linking to any external data, will be
              generated if blank)
            </li>
          </ul>

          {/* CSV format table */}
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              aria-label="CSV column format reference"
            >
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th scope="col" className="px-4 py-3 text-left font-normal">
                    id
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-normal">
                    interview
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-normal">
                    comment
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 align-top">
                    (optional) column contains links to any external data, will
                    be generated if blank
                  </td>
                  <td className="px-4 py-3 align-top">
                    (optional) column contains respondent name, which can be a
                    pseudonym, or blank for anonymous speakers
                  </td>
                  <td className="px-4 py-3 align-top">
                    (required) column contains the text of responses to analyze
                    with T3C
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            A{" "}
            <a className="underline" href="/Talk-to-the-City-Sample.csv">
              sample CSV
            </a>{" "}
            is available to download.
          </p>

          <h5>How secure is the data I send through T3C?</h5>
          <p>
            See our{" "}
            <a className="underline" href="#privacy-security">
              Privacy and security
            </a>{" "}
            section for detailed information on our policies.
          </p>

          <h5>Who can I contact for support?</h5>
          <p>
            Reach out to{" "}
            <a className="underline" href="mailto:hello@aiobjectives.org">
              hello@aiobjectives.org
            </a>{" "}
            with questions or feedback.
          </p>
        </ContentGroup>

        <ContentGroup>
          <h3 id="tutorial">Report creation FAQ</h3>

          <h5>How can I make an audio transcription?</h5>
          <p>
            T3C can process transcripts from audio or video recordings. You can
            use cloud-based services like Otter.ai, Rev, or Happy Scribe, or
            desktop applications like Descript or OpenAI Whisper for local
            transcription. We have a{" "}
            <a className="underline" href="/help">
              detailed transcription guide
            </a>{" "}
            covering these options and their trade-offs.
          </p>

          <h5 id="language-limitations">
            Are there any language limitations we should be aware of?
          </h5>
          <p>
            T3C can process text responses in 50+ languages, and audio messages
            are transcribed using OpenAI Whisper. Whisper generally performs
            well across major languages, but accuracy can vary for certain
            accents, regional dialects, or low-resource languages, as well as in
            noisy recording environments. This means some transcriptions may
            contain errors. For projects where language accuracy is critical, we
            recommend reviewing a small sample of transcripts to ensure the
            model meets your needs.
          </p>

          <h5>How do I customize the analysis prompts?</h5>
          <p>
            On the{" "}
            <Link href="/create" className="underline">
              create report page
            </Link>
            , expand the "Advanced Settings" section to find "Customize AI
            prompts". You can modify prompts to:
          </p>
          <ul className="list-disc list-inside pl-2">
            <li>
              Specify the number of topics/subtopics, or suggest possible themes
              to include
            </li>
            <li>Adjust length of direct quotations from respondents</li>
            <li>Focus on specific questions, topics, or perspectives</li>
          </ul>
        </ContentGroup>

        <ContentGroup>
          <h3 id="privacy-security">Privacy & security</h3>

          <h5>What we collect</h5>
          <ul className="list-disc list-outside pl-6">
            <li>
              User input: text or queries entered into "Talk to the City" are
              transmitted to OpenAI's API for generating responses. Raw input
              text, intermediate stages of processing, and final report data are
              stored in our cloud infrastructure so we can serve the report.
            </li>
            <li>
              Technical Information: We automatically collect certain technical
              information such as your IP address, browser type, and device
              information for security and service optimization purposes.
            </li>
            <li>
              Cookies and local storage: We use essential cookies and local
              storage to maintain your session and basic preferences. No
              third-party tracking cookies are used.
            </li>
            <li>
              No sensitive data: Users are encouraged to refrain from submitting
              any personal, sensitive, confidential, or otherwise individually
              identifiable information. T3C disclaims any responsibility or
              liability for the inclusion of prohibited data in user
              submissions.
            </li>
          </ul>

          <h5>Data handling</h5>
          <ul className="list-disc list-outside pl-6">
            <li>
              Data transmission: When you use "Talk to the City," your text
              input (specifically the “comment” column of a CSV) is transmitted
              securely to OpenAI's API for processing. This processing step is
              required to generate summaries, reports, and insights from T3C.
            </li>
            <li>
              Limited data retention by OpenAI: OpenAI does not use data
              submitted via API for long-term use for improving its models.
              However, in accordance with{" "}
              <a
                target="_blank"
                href="https://platform.openai.com/docs/guides/your-data"
              >
                OpenAI’s API policy
              </a>{" "}
              your inputs may be retained for up to 30 days for the sole purpose
              of monitoring for fraud and abuse. After this period, the data is
              deleted.
            </li>
            <li>
              No-Opt Out of Retention: Participants should be aware that this
              30-day retention is a standard condition of using OpenAI’s API. At
              this time, Talk to the City does not qualify for OpenAI’s “Zero
              Data Retention” service tier, and therefore we cannot offer an
              opt-out of this temporary retention.
            </li>
          </ul>

          <h5>How we protect your data</h5>
          <ul className="list-disc list-outside pl-6">
            <li>
              Encryption: All data transmitted to OpenAI is encrypted in transit
              using HTTPS.
            </li>
            <li>
              Error monitoring: We collect anonymous error logs to maintain
              service quality, excluding any user input or personal information.
            </li>
            <li>
              Data minimization: We collect only what is necessary to provide
              the service.
            </li>
            <li>
              Data deletion: You may request deletion of any data associated
              with you by contacting us (
              <a className="underline" href="mailto:hello@aiobjectives.org">
                hello@aiobjectives.org
              </a>
              ).
            </li>
          </ul>

          <h5>Third-party sharing</h5>
          <p>
            No additional sharing: Your data is sent exclusively to select
            providers including OpenAI, Google Cloud Platform, Posthog, and
            Weights and Biases for processing. We do not share, sell, or
            distribute your data to any entity.
          </p>

          <h5>Your rights</h5>
          <ul className="list-disc list-outside pl-6">
            <li>
              Access and control: You have the right to access, correct, or
              delete your technical data.
            </li>
            <li>
              Data portability: You may request an export of any data we hold
              about you.
            </li>
            <li>
              Opt-out rights: You can opt out of any optional data collection or
              processing.
            </li>
            <li>
              Additional Privacy Rights: Participants in the EU and UK have
              rights under GDPR/UK GDPR, including access, correction, deletion,
              portability, the right to object to processing, and the right to
              lodge a complaint with a supervisory authority. California
              residents have rights under the CCPA, including access to and
              deletion of personal information, the right to know what data is
              collected, and the right to request that data not be sold or
              shared.
            </li>
            <li>
              All such requests can be made by contacting{" "}
              <a className="underline" href="mailto:hello@aiobjectives.org">
                hello@aiobjectives.org
              </a>
              .
            </li>
          </ul>

          <h5>Content ownership</h5>
          <ul className="list-disc list-outside pl-6">
            <li>User inputs: You retain rights to your input content.</li>
            <li>
              AI responses: Outputs generated by an external AI (currently only
              OpenAI models) are subject to OpenAI’s terms of service and usage
              policies.
            </li>
          </ul>

          <h5>Age Restrictions</h5>
          <p>
            This service is not intended for users under the age of 13. Users
            between 13-16 years old may require parental consent depending on
            their jurisdiction.
          </p>

          <h5>Your Responsibilities</h5>
          <ul className="list-disc list-outside pl-6">
            <li>
              Safe use: Avoid submitting sensitive personal information or
              confidential data through the service.
            </li>
            <li>
              Compliance: Ensure your use of the service complies with
              applicable laws and regulations.
            </li>
          </ul>

          <h5>Changes to This Policy</h5>
          <p>
            We may update this Privacy and Security Policy from time to time.
            Any changes will be reflected here with an updated effective date.
            Significant changes will be communicated directly to users.
          </p>
          <p className="text-muted-foreground">
            Policy last updated: 18 Sept 2025
          </p>
        </ContentGroup>
      </ContentGroupContainer>
    </Col>
  );
}
