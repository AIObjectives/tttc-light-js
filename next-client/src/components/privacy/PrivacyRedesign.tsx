export default function PrivacyRedesign() {
  return (
    <div className="overflow-x-hidden bg-white">
      <HeroSection />
      <ContentSection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 lg:px-28 pt-16 pb-4">
      <h1 className="text-7xl lg:text-[96px] font-medium tracking-wide leading-tight mb-8 text-center">
        Privacy and Security
      </h1>
      <p className="text-xl text-foreground leading-[31px]">
        Our privacy and security policy is below. We are{" "}
        <strong>
          currently working on supporting more than one Large Language Model
        </strong>
        , including local models supplied by users. If you require this or are
        interested in funding this work, please reach out at{" "}
        <a
          href="mailto:t3c@objective.is"
          className="text-indigo-600 hover:underline"
        >
          t3c@objective.is
        </a>
        .
      </p>
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-bold text-xl text-foreground leading-[31px] mt-8 mb-3">
      {children}
    </p>
  );
}

function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc ml-8 space-y-3 text-xl text-foreground [&_p]:text-xl [&_li]:leading-[31px]">
      {children}
    </ul>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xl text-foreground leading-[31px] mb-3">{children}</p>
  );
}

function ContentSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 lg:px-28 pb-16">
      <SectionHeading>What we collect</SectionHeading>
      <Bullets>
        <li>
          User input: text or queries entered into &ldquo;Talk to the
          City&rdquo; are transmitted to OpenAI&apos;s API for generating
          responses. Raw input text, intermediate stages of processing, and
          final report data are stored in our cloud infrastructure so we can
          serve the report.
        </li>
        <li>
          Technical Information: We automatically collect certain technical
          information such as your IP address, browser type, and device
          information for security and service optimization purposes.
        </li>
        <li>
          Cookies and local storage: We use essential cookies and local storage
          to maintain your session and basic preferences. No third-party
          tracking cookies are used.
        </li>
        <li>
          No sensitive data: Users are encouraged to refrain from submitting any
          personal, sensitive, confidential, or otherwise individually
          identifiable information. T3C disclaims any responsibility or
          liability for the inclusion of prohibited data in user submissions.
        </li>
      </Bullets>

      <SectionHeading>Data handling</SectionHeading>
      <Bullets>
        <li>
          Data transmission: When you use &ldquo;Talk to the City,&rdquo; your
          text input (specifically the &ldquo;comment&rdquo; column of a CSV) is
          transmitted securely to OpenAI&apos;s API for processing. This
          processing step is required to generate summaries, reports, and
          insights from T3C.
        </li>
        <li>
          Limited data retention by OpenAI: OpenAI does not use data submitted
          via API for long-term use for improving its models. However, in
          accordance with{" "}
          <a
            href="https://platform.openai.com/docs/guides/your-data"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            OpenAI&apos;s API policy
          </a>{" "}
          your inputs may be retained for up to 30 days for the sole purpose of
          monitoring for fraud and abuse. After this period, the data is
          deleted.
        </li>
        <li>
          No-Opt Out of Retention: Participants should be aware that this 30-day
          retention is a standard condition of using OpenAI&apos;s API. At this
          time, Talk to the City does not qualify for OpenAI&apos;s &ldquo;Zero
          Data Retention&rdquo; service tier, and therefore we cannot offer an
          opt-out of this temporary retention.
        </li>
      </Bullets>

      <SectionHeading>How we protect your data</SectionHeading>
      <Bullets>
        <li>
          Encryption: All data transmitted to OpenAI is encrypted in transit
          using HTTPS.
        </li>
        <li>
          Error monitoring: We collect anonymous error logs to maintain service
          quality, excluding any user input or personal information.
        </li>
        <li>
          Data minimization: We collect only what is necessary to provide the
          service.
        </li>
        <li>
          Data deletion: You may request deletion of any data associated with
          you by contacting us (
          <a
            href="mailto:t3c@objective.is"
            className="text-indigo-600 hover:underline"
          >
            t3c@objective.is
          </a>
          ).
        </li>
      </Bullets>

      <SectionHeading>Third-party sharing</SectionHeading>
      <Paragraph>
        No additional sharing: Your data is sent exclusively to select providers
        including OpenAI, Google Cloud Platform, Posthog, and Weights and Biases
        for processing. We do not share, sell, or distribute your data to any
        entity.
      </Paragraph>

      <SectionHeading>Your rights</SectionHeading>
      <Bullets>
        <li>
          Access and control: You have the right to access, correct, or delete
          your technical data.
        </li>
        <li>
          Data portability: You may request an export of any data we hold about
          you.
        </li>
        <li>
          Opt-out rights: You can opt out of any optional data collection or
          processing.
        </li>
        <li>
          Additional Privacy Rights: Participants in the EU and UK have rights
          under GDPR/UK GDPR, including access, correction, deletion,
          portability, the right to object to processing, and the right to lodge
          a complaint with a supervisory authority. California residents have
          rights under the CCPA, including access to and deletion of personal
          information, the right to know what data is collected, and the right
          to request that data not be sold or shared.
        </li>
        <li>
          All such requests can be made by contacting{" "}
          <a
            href="mailto:t3c@objective.is"
            className="text-indigo-600 hover:underline"
          >
            t3c@objective.is
          </a>
          .
        </li>
      </Bullets>

      <SectionHeading>Content ownership</SectionHeading>
      <Bullets>
        <li>User inputs: You retain rights to your input content.</li>
        <li>
          AI responses: Outputs generated by an external AI (currently only
          OpenAI models) are subject to OpenAI&apos;s terms of service and usage
          policies.
        </li>
      </Bullets>

      <SectionHeading>Age Restrictions</SectionHeading>
      <Paragraph>
        This service is not intended for users under the age of 13. Users
        between 13–16 years old may require parental consent depending on their
        jurisdiction.
      </Paragraph>

      <SectionHeading>Your Responsibilities</SectionHeading>
      <Bullets>
        <li>
          Safe use: Avoid submitting sensitive personal information or
          confidential data through the service.
        </li>
        <li>
          Compliance: Ensure your use of the service complies with applicable
          laws and regulations.
        </li>
      </Bullets>

      <SectionHeading>Changes to This Policy</SectionHeading>
      <Paragraph>
        We may update this Privacy and Security Policy from time to time. Any
        changes will be reflected here with an updated effective date.
        Significant changes will be communicated directly to users.
      </Paragraph>
      <Paragraph>Policy last updated: 18 Sept 2025</Paragraph>
    </section>
  );
}
