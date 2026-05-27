"use client";

import Link from "next/link";
import { useState } from "react";

export default function ProductRedesign() {
  return (
    <div className="overflow-x-hidden bg-white">
      <HeroSection />
      <IntroSection />
      <WhoT3CIsFor />
      <WhatT3CDoes />
      <ReadyToGetStarted />
      <HowSurveysWork />
      <HowReportsWork />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="px-8 lg:px-28 pt-16 pb-8">
      <h1 className="text-5xl lg:text-[96px] font-medium tracking-tight leading-tight text-center">
        Talk to the [<span className="text-indigo-600"> everyone </span>]
      </h1>
    </section>
  );
}

function IntroSection() {
  return (
    <section className="px-8 lg:px-28 pb-8">
      <p className="text-xl text-muted-foreground leading-[31px]">
        Talk to the City (T3C) is an <strong>open-source AI tool</strong> that
        reimagines how communities, institutions, and decision-makers gather and
        act on public input. T3C allows you to design and launch{" "}
        <strong>conversational AI surveys</strong> to engage diverse groups at
        scale. Then, T3C helps you explore the results, distilling conversations
        into <strong>interactive reports</strong> that highlight themes and link
        every insight back to real participant quotes.
      </p>
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl font-semibold tracking-tight leading-9 mb-6">
      {children}
    </h2>
  );
}

function AudienceCard({
  title,
  borderColor,
  bgColor,
  items,
}: {
  title: string;
  borderColor: string;
  bgColor: string;
  items: string[];
}) {
  return (
    <div
      className={`flex flex-col gap-3 border rounded-md p-4 ${borderColor} ${bgColor}`}
    >
      <p className="font-medium leading-6">{title}</p>
      <ul className="list-disc ml-6 space-y-1">
        {items.map((item) => (
          <li key={item} className="leading-[26px]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhoT3CIsFor() {
  return (
    <section className="px-8 lg:px-28 pb-12">
      <SectionHeading>Who T3C is great for</SectionHeading>
      <p className="text-xl text-muted-foreground leading-[31px] mb-8">
        T3C is ideal for people who need to collect richer data than surveys
        allow, at bigger scales than is possible through traditional interviews.
        We&apos;re great for quickly understanding many diverse perspectives,
        from collecting student experiences across a semester to capturing the
        local context of why social programs succeed and fail across many
        implementations. Our reports are perfect for grounding discussion among
        communities, organizations and decision-makers.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
        <AudienceCard
          title="Communities and policy-makers"
          borderColor="border-theme_violet"
          bgColor="bg-theme_violet-accent"
          items={[
            "Raise topics for deliberation",
            "Identify points of agreement and disagreement",
            "Ground discussion in real voices",
            "Collect local knowledge to shape policy and programs",
          ]}
        />
        <AudienceCard
          title="Mission-driven organizations"
          borderColor="border-theme_blueSea"
          bgColor="bg-theme_blueSea-accent"
          items={[
            "Conduct needs assessments",
            "Receive feedback in real time from staff and program participants",
            "Track hard-to-quantify outcomes",
          ]}
        />
        <AudienceCard
          title="Funders"
          borderColor="border-theme_blueSky"
          bgColor="bg-theme_blueSky-accent"
          items={[
            "Collect expertise for field-building and scoping exercises",
            "Stay aware of grantee activities",
            "Verify bottlenecks and anticipate transition challenges",
          ]}
        />
        <AudienceCard
          title="Event hosts"
          borderColor="border-theme_greenLime"
          bgColor="bg-theme_greenLime-accent"
          items={[
            "Collect real time ideas and reactions from workshop and conference participants",
            "Understand experiences across multiple events like university classes",
          ]}
        />
      </div>
    </section>
  );
}

function WhatT3CDoes() {
  return (
    <section className="px-8 lg:px-28 pb-12">
      <SectionHeading>What T3C does</SectionHeading>
      <div className="bg-theme_violet-accent rounded-3xl p-8 max-w-5xl mx-auto">
        <div className="relative w-full aspect-video">
          <iframe
            src="https://www.youtube.com/embed/M_lEuifm4IQ"
            title="Talk to the City demo video"
            className="absolute inset-0 w-full h-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}

function ReadyToGetStarted() {
  return (
    <section className="px-8 lg:px-28 py-16 flex justify-center">
      <Link
        href="/pricing"
        className="bg-white border border-border rounded-[28px] w-full max-w-[625px] py-12 flex items-center justify-center text-indigo-600 text-4xl lg:text-5xl font-medium hover:bg-indigo-50 transition-colors"
      >
        Ready to get started?
      </Link>
    </section>
  );
}

// Click-to-expand bubble matching the Figma "How … works" sections.
function CollapsibleBubble({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full text-left border border-slate-500 rounded-[27px] px-8 py-5 flex items-center justify-between bg-transparent cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </span>
        <span aria-hidden className="text-2xl text-muted-foreground">
          {isOpen ? "–" : "+"}
        </span>
      </button>
      {isOpen && (
        <div className="px-8 pt-6 text-xl text-muted-foreground leading-[31px]">
          {children}
        </div>
      )}
    </div>
  );
}

function HowSurveysWork() {
  return (
    <section className="px-8 lg:px-28 pb-8">
      <CollapsibleBubble title="How conversational surveys work">
        <p className="mb-3">
          You can use our study creator to design and launch an LLM-powered
          conversational survey through WhatsApp. T3C can operate in three
          different modes:
        </p>
        <ul className="list-disc ml-8 space-y-3 mb-3">
          <li>
            <strong>Listening mode:</strong> T3C opens with an initial prompt,
            then listens to the participant, providing brief responses
            (&ldquo;Yes, I&apos;m here&rdquo;) but not asking questions or
            steering the conversation. When the participant is done, they say
            &ldquo;Finalize.&rdquo;
          </li>
          <li>
            <strong>Survey mode:</strong> T3C works its way through the set of
            survey questions you provide without asking follow-up questions. T3C
            will notify the participant when the survey is over.
          </li>
          <li>
            <strong>Follow-up mode:</strong> This mode is used to conduct
            semi-structured, adaptive surveys that act more like traditional
            interviews. Instead of moving straight through the questions you
            provide, T3C asks follow-up questions.
            <ul className="list-disc ml-8 mt-2">
              <li>
                <strong>How it works:</strong> T3C keeps the last 30 exchanges
                to provide context for follow-up questions. After a participant
                responds, T3C consults a bank of follow-up questions and selects
                the most appropriate one given the context, or is prompted to
                generate a new question if none of the existing ones are
                suitable. It replaces placeholder variables in the follow-up
                questions with specific content, e.g., &ldquo;Tell me more about
                X&rdquo; becomes &ldquo;Tell me more about the weather where you
                live.&rdquo; After asking the follow-up question, T3C moves on
                to the next structured question.
              </li>
            </ul>
          </li>
        </ul>
        <p className="mb-3">
          T3C can also support a deliberative mode that prompts participants to
          reflect on their viewpoints in follow-up sessions. For each
          participant, T3C can select similar and dissimilar claims across the
          collected data and present them for discussion. The way claims are
          presented, the claims themselves and the style with which the bot
          prompts reflection can all be customized. Currently, deliberative mode
          is not available in self-service; please reach out if you are
          interested.
        </p>
        <p className="font-medium mb-2">Text, voice and language support</p>
        <p className="mb-3">
          All modes accept voice messages. T3C can also be configured to operate
          in different languages and is prompted to ask questions in the
          participant&apos;s language if detected.
        </p>
        <p className="font-medium mb-2">FAQs</p>
        <p>
          We answer FAQs about data collection{" "}
          <Link href="/about" className="text-indigo-600 hover:underline">
            here
          </Link>{" "}
          and provide information on security and privacy{" "}
          <Link href="/safety" className="text-indigo-600 hover:underline">
            here
          </Link>
          .
        </p>
      </CollapsibleBubble>
    </section>
  );
}

function HowReportsWork() {
  return (
    <section className="px-8 lg:px-28 pb-16">
      <CollapsibleBubble title="How reports work">
        <p className="mb-3">
          We use Large Language Models (LLMs) to extract themes from your data,
          summarize specific claims and link those claims back to exact quotes.
          We create an interactive report from the results, combining all scales
          of analysis, and store for you on the talktothe.city site. You can
          modify the prompts used to create reports by looking under
          &ldquo;Advanced Settings&rdquo; on the report creator page.
        </p>
        <p className="font-medium mb-2">Report access</p>
        <p className="mb-3">
          Reports can be kept for your eyes only or made public to anybody who
          has the exact URL.
        </p>
        <p className="font-medium mb-2">Experimental features</p>
        <p className="mb-3">
          We have a few experimental features for you to try, including ranking
          claims by controversiality and identifying how constructive or
          divisive responses are. Reports can also include audio or video
          snippets, but this requires some pre-processing; if you can&apos;t
          figure it out from our Github please reach out and we will help you.
        </p>
        <p className="font-medium mb-2">FAQs</p>
        <p>
          We answer FAQs about reports{" "}
          <Link href="/about" className="text-indigo-600 hover:underline">
            here
          </Link>{" "}
          and provide information on the risks associated with using LLMs for
          analysis{" "}
          <Link href="/safety" className="text-indigo-600 hover:underline">
            here
          </Link>
          .
        </p>
      </CollapsibleBubble>
    </section>
  );
}
