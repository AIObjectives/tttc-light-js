import { Card, CardContent } from "@src/components/elements";
import { Col } from "@src/components/layout";
import { QuoteText } from "@src/components/quote/Quote";
import React from "react";

/**
 * About page for T3C
 * TODO: The spacing between the bullet point and its text is off from the designs. Find a way to control this.
 */
export default function AboutPage() {
  return (
    <Col gap={3} className="p-8 w-[832px] m-auto">
      <h2>About</h2>

      <div>
        <p className="text-muted-foreground">Jump to:</p>
        <ul className="list-disc list-inside text-muted-foreground underline pl-2">
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><a href="#case-studies">Case studies</a></li>
          <li><a href="#tutorial">Report creation FAQ</a></li>
          <li><a href="#privacy-security">Privacy & security</a></li>
        </ul>
        <br />
        <p>
          Talk to the City (T3C) helps large groups of people coordinate by
          understanding each other better.
        </p>
        <br />
        <p>
          It's an open-source tool for public consultation that solves the
          trade-off between depth and scale, using LLMs for comprehensive
          analysis of large response data. Whether you're soliciting general
          feedback from thousands of constituents, or untangling subtle details
          of a complex concern, T3C preserves the nuance of individual views
          while making sense of the collective conversation.
        </p>
        <br />
        <p>
          Previous versions of Talk to the City have been used by the
          Taiwanese government and the Taiwan AI Assembly, unions, policy makers
          and more. See our <a href="#case-studies" className="underline">
          case studies</a> for more details.
        </p>
        <br />
        <p>
          Built by the <a className="underline"
            href="https://ai.objectives.institute">AI Objectives
          Institute</a>. All code is <a className="underline"
            href="https://github.com/AIObjectives/tttc-light-js">
              open-source on GitHub</a>.
        </p>
        <br />
        <p className="text-muted-foreground">
          Have a question we didn't answer here, or interested in direct
          support in using Talk to the City? Reach out at <a className="underline"
            href="mailto:hello@objective.is">hello@objective.is</a>.
        </p>
      </div>
      <br />

      <Testimonial text={audreyQuote} />

      <Testimonial text={rizinaQuote} />
      <br />

      <h3 id="how-it-works">How it works</h3>
      <p>
        We use Large Language Models (LLMs) to analyze broad themes from
        large datasets of free-text responses, summarize specific claims, and
        link those claims back to exact quotes. We use LLMs from OpenAI
        (default: gpt-4o-mini), and are adding more options later this year.
      </p>
      <p>
        We create an interactive report from the results, combining all scales
        of analysis, stored for you on the talktothe.city site. See examples in
        the <a href="#case-studies" className="underline">Case studies</a> section.
      </p>
      <p>
        This alpha version of T3C accepts input of any unstructured text,
        including free-form survey responses, interview and meeting transcripts,
        and collections of social media posts. We have experimental features to
        process audio and video datasets, and include video in reports &ndash; reach
        out if you're interested in using these features while they're under development.
      </p>
      <p>
        For this alpha launch, all reports are <em>temporarily public</em> to
        anyone who has the URL; we're adding password protection to reports soon.
      </p>
      <br />

      <h3 id="case-studies">Case studies</h3>

      <ul className="list-disc list-inside underline pl-2">
        <li className="marker:pr-2">
          <a href="https://ai.objectives.institute/blog/amplifying-voices-talk-to-the-city-in-taiwan">
            Amplifying Voices: Talk to the City in Taiwan
          </a>
        </li>
        <li>
          <a href="https://ai.objectives.institute/blog/using-ai-to-give-people-a-voice-a-case-study-in-michigan">
            Using AI to Give People a Voice, a Case Study in Michigan
          </a>
        </li>
        <li>
          <a>Coming Soon: Deliberative Technology in Polarized Contexts</a>
        </li>
      </ul>
      <br />

      <h3 id="faq">FAQ</h3>

      <h5>What inputs do I need to create a T3C report?</h5>
      <ol className="list-decimal list-inside pl-2">
        <li>A correctly formatted CSV file</li>
        <li>An OpenAI API key</li>
      </ol>
      <br />

      <h5>How do I sign into T3C?</h5>
      <p>We currently allow signing in with accounts managed by Google:</p>
      <ol className="list-decimal list-inside pl-2">
        <li>Click the "Sign in" button in the top right corner</li>
        <li>Choose the Google account you want to sign in with and complete authentication</li>
        <li>You'll then have access to your T3C dashboard</li>
      </ol>
      <br />

      <h5>How secure is the data I send through T3C?</h5>
      <p>
        See our <a className="underline" href="#privacy-security">Privacy
          and security</a> section for detailed information on our policies.
      </p>
      <br />

      <h5>Who can I contact for support?</h5>
      <p>
        Reach out to <a href="mailto:hello@objective.is">hello@objective.is</a> with
        questions or feedback.
      </p>
      <br />

      <h3 id="tutorial">Report creation FAQ</h3>

      <h5>How do I create a new report?</h5>
      <ol className="list-decimal list-inside pl-2">
        <li>Click the "Create a report" button in the upper right corner</li>
        <li>
          Fill in required fields:
          <ul className="list-disc list-inside pl-2">
            <li>Report name (e.g. "Sentiment Analysis June 2025")</li>
            <li>Report description (including context and purpose)</li>
            <li>The dataset to analyze, as a CSV</li>
            <li>Your OpenAI API key</li>
          </ul>
        </li>
        <li>
          Optionally, modify the prompts for any stage of the processing
          pipeline to better fit your use case/data.
        </li>
      </ol>
      <br />

      <h5>What data format does the CSV file need to follow?</h5>
      <ul className="list-disc list-inside pl-2">
        <li>Required column: "comment" (contains the text of the responses to analyze with T3C)</li>
        <li>Optional column: "interview" (respondent name, can be "Anonymous" or blank)</li>
        <li>Optional column: “id” (for linking to any external data, will be generated if blank)</li>
      </ul>
      <p>
        A <a className="underline"
            href="https://docs.google.com/spreadsheets/d/15cKedZ-AYPWMJoVFJY6ge9jUEnx1Hu9MHnhQ_E_Z4FA/edit?gid=0#gid=0">
        sample CSV template</a> is available in Google Sheets.
      </p>
      <br />

      <h5>How do I customize the analysis prompts?</h5>
      <p>You can modify prompts to:</p>
      <ul className="list-disc list-inside pl-2">
        <li>Specify the number of topics/subtopics, or suggest possible themes to include</li>
        <li>Adjust length of direct quotations from respondents</li>
        <li>Focus on specific response types</li>
      </ul>
      <br />

      <h3 id="privacy-security">Privacy & security</h3>

      <h5>Data handling</h5>
      <ul className="list-disc list-outside pl-6">
        <li>
          Data transmission: When you use "Talk to the City," your text input
          (specifically the “comment” column of a CSV) is sent to OpenAI's API
          for processing.
        </li>
        <li>
          No data retention by OpenAI: OpenAI does not store the data sent to its
          API for long-term use, in accordance with their API usage policies.
          However, your inputs may be temporarily processed to improve their AI
          models unless you explicitly opt out.
        </li>
        <li>
          Encryption and deletion of OpenAI API Keys: Your keys are encrypted
          throughout our platform (sent via SSL-encrypted headers), and are not 
          stored locally or on any device or within the application once your 
          report is completed. We only use your API keys for the purpose of 
          generating your report.
        </li>
      </ul>
      <br />

      <h5>What we collect</h5>
      <ul className="list-disc list-outside pl-6">
        <li>
          User input: text or queries entered into "Talk to the City" are temporarily
          transmitted to OpenAI's API for generating responses. Raw input text,
          intermediate stages of processing, and final report data are stored in
          our cloud infrastructure so we can serve the report.
        </li>
        <li>
          Technical Information: We automatically collect certain technical
          information such as your IP address, browser type, and device information
          for security and service optimization purposes.
        </li>
        <li>
          Cookies and local storage: We use essential cookies and local storage
          to maintain your session and basic preferences. No third-party tracking
          cookies are used.
        </li>
        <li>
          No sensitive data: We discourage users from sharing personal, sensitive,
          or identifiable information in their input.
        </li>
      </ul>
      <br />

      <h5>How we protect your data</h5>
      <ul className="list-disc list-outside pl-6">
        <li>
          Encryption: All data transmitted to OpenAI is encrypted in transit using HTTPS.
        </li>
        <li>
          Error monitoring: We collect anonymous error logs to maintain service
          quality, excluding any user input or personal information.
          </li>
        <li>
          Data minimization: We collect only what is necessary to provide the service.
        </li>
        <li>
          Data deletion: You may request deletion of any data associated with
          you by contacting us (<a className="underline"
            href="mailto:hello@objective.is">hello@objective.is</a>).
        </li>
      </ul>
      <br />

      <h5>Third-party sharing</h5>
      <p>No additional sharing: Your data is sent exclusively to OpenAI for
        processing. We do not share, sell, or distribute your data to any entity.
      </p>
      <br />

      <h5>Your rights</h5>
      <ul className="list-disc list-inside pl-2">
        <li>
          Access and control: You have the right to access, correct, or delete
          your technical data.
        </li>
        <li>
          Data portability: You may request an export of any data we hold about you.
        </li>
        <li>
          Opt-out rights: You can opt out of any optional data collection or processing.
        </li>
        <li>
          EU/UK rights: Additional rights under GDPR/UK GDPR include the right to
          object to processing and the right to lodge a complaint with supervisory authorities.
        </li>
      </ul>
      <br />

      <h5>Content ownership</h5>
      <ul className="list-disc list-inside pl-2">
        <li>User inputs: You retain rights to your input content.</li>
        <li>
          AI responses: Outputs generated by an external AI (currently only OpenAI
          models) are subject to OpenAI’s terms of service and usage policies.
        </li>
      </ul>
      <br />

      <h5>Age Restrictions</h5>
      <p>
        This service is not intended for users under the age of 13. Users
        between 13-16 years old may require parental consent depending on their
        jurisdiction.
      </p>
      <br />

      <h5>Your Responsibilities</h5>
      <ul className="list-disc list-inside pl-2">
        <li>
          Safe use: Avoid submitting sensitive personal information or
          confidential data through the service.
        </li>
        <li>
          Compliance: Ensure your use of the service complies with applicable
          laws and regulations.
        </li>
      </ul>
      <br />

      <h5>Changes to This Policy</h5>
      <p>
        We may update this Privacy and Security Policy from time to time. Any
        changes will be reflected here with an updated effective date.
        Significant changes will be communicated directly to users.
      </p>
      <p className="text-muted-foreground">
        Policy last updated: 9 Feb 2025
      </p>
      <br />

    </Col>
  );
}

function Testimonial({ text }: { text: string | JSX.Element }) {
  return (
    <Card>
      <CardContent>
        <QuoteText
          text={text}
          interview=""
          className="text-muted-foreground"
          iconClassName="fill-muted-foreground"
        />
      </CardContent>
    </Card>
  );
}

const audreyQuote = (
  <>
    “Ten years ago, the vTaiwan scope was limited, because stakeholder groups
    needed to adapt to the technology at the time. Today, this is being bridged
    with the advent of language models that can adapt to their needs. Back in
    2014, it was impossible with the capacity of g0v contributors to interview a
    mini public of people and aggregate their ideas while preserving the full
    nuance. But now, with Talk to the City's help, that cost has been reduced to
    essentially zero. It's broad-listening and it can change the nature of this
    recursive public.”
    <br />– Audrey Tang, Taiwan's 1st Digital Minister and co-author of{" "}
    <a className="underline" href="https://www.plurality.net/">
      Plurality.net
    </a>
  </>
);

const rizinaQuote = (
  <>
    “Given the vast amount of qualitative data we collected, Talk to the City's
    analysis was crucial in identifying gender-specific challenges in the lives
    of young Australian women and men. This analysis helped us craft our policy
    recommendations, focusing on the experiences of marginalised demographics.
    Having the data organised under specific themes, then being able to go
    through the interviewees actual statements, was powerful.”
    <br />– Rizina Yadav on behalf of YWPS, a social initiative for improving
    the life outcomes of Australian women during the critical decade of 18-28.
  </>
);
