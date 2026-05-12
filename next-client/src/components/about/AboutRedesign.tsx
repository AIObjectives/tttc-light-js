import Image from "next/image";
import Link from "next/link";
import {
  EXTERNAL_LINKS,
  MEDIA_ITEMS,
  SAMPLE_REPORTS,
} from "@/components/landing/landing-config";

export default function AboutRedesign() {
  return (
    <div className="overflow-x-hidden bg-white">
      <HeroSection />
      <ContentSection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="px-8 lg:px-28 pt-16 pb-8">
      <h1 className="text-7xl lg:text-[96px] font-medium tracking-wide leading-tight mb-10">
        About us
      </h1>
      <p className="text-xl text-muted-foreground max-w-5xl leading-[31px] mb-4">
        T3C is built by the{" "}
        <a
          href={EXTERNAL_LINKS.AI_OBJECTIVES_INSTITUTE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline"
        >
          AI Objectives Institute
        </a>
        , a nonprofit R&D lab dedicated to decoding and realigning the
        incentives that determine AI futures. Our technology is{" "}
        <strong>open source</strong> and you can run it yourself by visiting our{" "}
        <a
          href={EXTERNAL_LINKS.GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline"
        >
          Github page
        </a>
        . We are always open to collaboration and you are welcome to reach out
        to us at{" "}
        <a
          href="mailto:t3c@objective.is"
          className="text-indigo-600 hover:underline"
        >
          t3c@objective.is
        </a>
        .
      </p>
      <p className="text-xl text-muted-foreground max-w-5xl leading-[31px]">
        Our mission in building T3C is to make it as easy as possible for groups
        to understand one another. We are entering an era in which it is cheaper
        to manufacture data about people than to listen to their voices. At AOI,
        we believe that building technology to capture and represent human
        perspectives is a critical step towards preserving our agency and
        identities as constituents, community members, professionals, students,
        patients, decision-makers...and humans.
      </p>
    </section>
  );
}

function ContentSection() {
  return (
    <section className="px-8 lg:px-28 pb-16">
      <GeneralFAQ />
      <ProductFAQ />
      <MediaSection />
    </section>
  );
}

function FAQHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl font-semibold tracking-tight leading-9 mt-16 mb-4">
      {children}
    </h2>
  );
}

function FAQQuestion({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xl font-medium text-muted-foreground leading-[31px] mb-2">
      {children}
    </p>
  );
}

function FAQAnswer({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xl font-normal text-muted-foreground leading-[31px] mb-10">
      {children}
    </p>
  );
}

function GeneralFAQ() {
  return (
    <div>
      <FAQHeading>General FAQ</FAQHeading>

      <FAQQuestion>Do you collaborate?</FAQQuestion>
      <FAQAnswer>
        Yes! We&apos;re always open to new projects and funding opportunities.
        We have a wide range of research interests and goals for T3C, so if
        there&apos;s something we don&apos;t currently do that you need, please
        reach out to discuss.
      </FAQAnswer>

      <FAQQuestion>What&apos;s your track record?</FAQQuestion>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] mb-2">
        We&apos;ve generated hundreds of reports and collected data from
        thousands of respondents for projects with governments, institutions and
        communities, including:
      </p>
      <ul className="list-disc text-xl font-normal text-muted-foreground leading-[31px] mb-10 ml-12 space-y-1">
        <li>
          <span className="font-medium">Taiwan:</span> We partnered with the
          Ministry of Digital Affairs to analyze public input on AI policy,
          same-sex marriage, and 2024 election platforms. Taiwan now hosts its
          own T3C instance, expanding to national institutions.
        </li>
        <li>
          <span className="font-medium">Tokyo Elections:</span> We engaged 1,000
          residents to identify policy priorities, informing the 2024
          gubernatorial race.
        </li>
        <li>
          <span className="font-medium">
            6th European Rural Parliament in Scotland:
          </span>{" "}
          We partnered with CrownShy and Scottish Rural Action (SRA) to support
          the 6th European Rural Parliament (ERP) in Inverurie, Scotland in
          2025.
        </li>
        <li>
          <span className="font-medium">Yemen:</span> CMI - Martti Ahtisaari
          Peace Foundation deployed T3C in 2025 to safely gather youth views on
          political participation and peacebuilding across 18 governorates with
          a 94% completion rate.
        </li>
      </ul>

      <FAQQuestion>
        Your use cases resonate but AI scares me. Should I still get in touch?
      </FAQQuestion>
      <FAQAnswer>
        Yep. We think a lot about how, when and why to apply AI to data
        collection and analysis. We&apos;ll always be honest about what our tool
        can and can&apos;t do, and we want to know what you think!
      </FAQAnswer>
    </div>
  );
}

function ProductFAQ() {
  return (
    <div>
      <FAQHeading>Product FAQ</FAQHeading>

      <FAQQuestion>
        Where can I get my privacy and security questions answered?
      </FAQQuestion>
      <FAQAnswer>
        We have a detailed{" "}
        <Link href="/safety" className="text-indigo-600 hover:underline">
          privacy and security policy
        </Link>
        . If you still have questions or specific requirements we can&apos;t
        meet, please reach out at t3c@objective.is. We are actively working on
        supporting multiple LLMs and welcome any technical or financial support
        towards that goal.
      </FAQAnswer>

      <FAQQuestion>
        Do you plan on supporting elicitation through platforms other than
        WhatsApp?
      </FAQQuestion>
      <FAQAnswer>
        Yes, we are working on adding browser chat currently. If you have other
        platforms you&apos;re interested in, please reach out.
      </FAQAnswer>

      <FAQQuestion>
        What phone numbers do you use to send WhatsApp messages?
      </FAQQuestion>
      <FAQAnswer>
        Our default is a U.S. phone number. You can provide your own non-U.S.
        phone number when setting up the study. If you would like us to acquire
        one for you, please reach out. Also, if you find that your number
        isn&apos;t working, please let us know so we can work with you on it.
      </FAQAnswer>

      <FAQQuestion>
        Do I have to collect data with your tool in order to generate reports?
      </FAQQuestion>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] mb-2">
        No, you can bring your own data for reports. T3C works with the
        following column headers:
      </p>
      <ul className="list-disc text-xl font-normal text-muted-foreground leading-[31px] mb-2 ml-8 space-y-1">
        <li>
          &ldquo;comment&rdquo; contains the text of the responses to analyze
          with T3C (required)
        </li>
        <li>
          &ldquo;interview&rdquo; contains the respondent name, which can be a
          pseudonym, or blank for anonymous speakers (optional)
        </li>
        <li>
          &ldquo;id&rdquo; for linking to any external data, will be generated
          if blank (optional)
        </li>
        <li>
          &ldquo;video&rdquo; and &ldquo;timestamp&rdquo; for links to Vimeo
          videos and the timestamps of specific text (optional)
        </li>
      </ul>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] mb-10">
        A{" "}
        <a
          href="https://talktothe.city/Talk-to-the-City-Sample.csv"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          sample CSV
        </a>{" "}
        is available to download.
      </p>

      <FAQQuestion>How can I make an audio transcription?</FAQQuestion>
      <FAQAnswer>
        T3C can process transcripts from audio or video recordings. You can use
        cloud-based services like Otter.ai, Rev, or Happy Scribe, or desktop
        applications like Descript or OpenAI Whisper for local transcription. We
        have a{" "}
        <a
          href="https://talktothe.city/help"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline"
        >
          detailed transcription guide
        </a>{" "}
        covering these options and their trade-offs.
      </FAQAnswer>

      <FAQQuestion>Are there any language limitations?</FAQQuestion>
      <FAQAnswer>
        T3C can process text responses in 50+ languages, and audio messages are
        transcribed using OpenAI Whisper. Whisper generally performs well across
        major languages, but accuracy can vary for certain accents, regional
        dialects, or low-resource languages, as well as in noisy recording
        environments. This means some transcriptions may contain errors. For
        projects where language accuracy is critical, we recommend reviewing a
        small sample of transcripts to ensure the model meets your needs.
      </FAQAnswer>

      <FAQQuestion>How do I customize the analysis prompts?</FAQQuestion>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] mb-2">
        Expand the &ldquo;Advanced Settings&rdquo; section in the report creator
        to find &ldquo;Customize AI prompts.&rdquo; You can modify prompts to:
      </p>
      <ul className="list-disc text-xl font-normal text-muted-foreground leading-[31px] mb-10 ml-8 space-y-1">
        <li>
          Specify the number of topics/subtopics, or suggest possible themes to
          include
        </li>
        <li>Adjust length of direct quotations from respondents</li>
        <li>Focus on specific questions, topics, or perspectives</li>
      </ul>

      <FAQQuestion>Are there risks to using T3C?</FAQQuestion>
      <FAQAnswer>
        Yes, as with any tool that uses Large Language Models. To learn more
        about risks specific to T3C, please explore our{" "}
        <Link href="/safety" className="text-indigo-600 hover:underline">
          Risks
        </Link>{" "}
        page.
      </FAQAnswer>

      <FAQQuestion>Can I see some examples of reports?</FAQQuestion>
      <FAQAnswer>
        Yes! Explore some case studies below to get a better idea of what our
        reports look like.
      </FAQAnswer>

      <CaseStudiesGrid />
    </div>
  );
}

function CaseStudiesGrid() {
  return (
    <div className="flex flex-wrap gap-4">
      {SAMPLE_REPORTS.map((report) => (
        <Link
          key={report.title}
          href={report.resourceUrl}
          className="flex-1 min-w-[260px] max-w-[320px] border border-border rounded shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="relative h-[171px] w-full rounded-t overflow-hidden">
            <Image
              src={report.imageUri}
              alt={report.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 260px"
            />
          </div>
          <div className="p-3 flex flex-col gap-2">
            <p className="text-sm text-foreground leading-5 line-clamp-2 tracking-wide">
              {report.title}
            </p>
            <p className="text-sm text-muted-foreground tracking-wide">
              {report.date}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function MediaSection() {
  return (
    <div>
      <h2 className="text-3xl font-semibold tracking-tight leading-9 mt-16 mb-6">
        Media
      </h2>
      <div className="flex flex-wrap gap-4">
        {MEDIA_ITEMS.map((item) => (
          <a
            key={item.title}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[260px] max-w-[320px] border border-border rounded shadow-sm hover:shadow-md transition-shadow"
          >
            <div
              className="relative h-[171px] w-full rounded-t overflow-hidden"
              style={
                "imageBgColor" in item
                  ? { backgroundColor: item.imageBgColor }
                  : undefined
              }
            >
              <Image
                src={item.imageUri}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 260px"
              />
            </div>
            <div className="p-3 flex flex-col gap-2">
              <p className="text-sm text-muted-foreground leading-5 line-clamp-2 tracking-wide">
                {item.title}
              </p>
              <div className="flex items-center gap-2">
                <div className="relative size-10 rounded-full overflow-hidden bg-black shrink-0">
                  <Image
                    src={item.sourceIcon}
                    alt={item.source}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
                <p className="text-base font-medium text-foreground truncate">
                  {item.source}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
