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
        <p>
          Talk to the City is an{" "}
          <a
            className="underline"
            href="https://github.com/AIObjectives/tttc-light-js"
          >
            open-source
          </a>{" "}
          LLM survey tool to improve collective discourse and decision-making by
          analyzing detailed qualitative responses to questions and generating
          an easy-to-navigate report based on the input data.
        </p>
        <br />
        <p>
          The previous version of Talk to the City has been used by the
          Taiwanese government and the Taiwan AI Assembly, unions, policy makers
          and more. Below are a list of case studies:
        </p>
        <br />
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
      </div>

      <h3>Testimonials</h3>

      <Testimonial text={audreyQuote} />

      <Testimonial text={rizinaQuote} />
    </Col>
  );
}

function Testimonial({ text }: { text: string | JSX.Element }) {
  return (
    <Card>
      <CardContent>
        <QuoteText
          text={text}
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
