import { ContentGroup } from "./ContentGroup";

/**
 * Privacy and Security section for the About page.
 * Contains detailed policy information about data collection, handling, and user rights.
 */
export function PrivacySecurity() {
  return (
    <ContentGroup>
      <h3 id="privacy-security">Privacy & security</h3>

      <h5>What we collect</h5>
      <ul className="list-disc list-outside pl-6">
        <li>
          User input: text or queries entered into "Talk to the City" are
          transmitted to OpenAI's API for generating responses. Raw input text,
          intermediate stages of processing, and final report data are stored in
          our cloud infrastructure so we can serve the report.
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
      </ul>

      <h5>Data handling</h5>
      <ul className="list-disc list-outside pl-6">
        <li>
          Data transmission: When you use "Talk to the City," your text input
          (specifically the "comment" column of a CSV) is transmitted securely
          to OpenAI's API for processing. This processing step is required to
          generate summaries, reports, and insights from T3C.
        </li>
        <li>
          Limited data retention by OpenAI: OpenAI does not use data submitted
          via API for long-term use for improving its models. However, in
          accordance with{" "}
          <a
            target="_blank"
            href="https://platform.openai.com/docs/guides/your-data"
            rel="noopener"
          >
            OpenAI's API policy
          </a>{" "}
          your inputs may be retained for up to 30 days for the sole purpose of
          monitoring for fraud and abuse. After this period, the data is
          deleted.
        </li>
        <li>
          No-Opt Out of Retention: Participants should be aware that this 30-day
          retention is a standard condition of using OpenAI's API. At this time,
          Talk to the City does not qualify for OpenAI's "Zero Data Retention"
          service tier, and therefore we cannot offer an opt-out of this
          temporary retention.
        </li>
      </ul>

      <h5>How we protect your data</h5>
      <ul className="list-disc list-outside pl-6">
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
          <a className="underline" href="mailto:hello@aiobjectives.org">
            hello@aiobjectives.org
          </a>
          ).
        </li>
      </ul>

      <h5>Third-party sharing</h5>
      <p>
        No additional sharing: Your data is sent exclusively to select providers
        including OpenAI, Google Cloud Platform, Posthog, and Weights and Biases
        for processing. We do not share, sell, or distribute your data to any
        entity.
      </p>

      <h5>Your rights</h5>
      <ul className="list-disc list-outside pl-6">
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
          OpenAI models) are subject to OpenAI's terms of service and usage
          policies.
        </li>
      </ul>

      <h5>Age Restrictions</h5>
      <p>
        This service is not intended for users under the age of 13. Users
        between 13-16 years old may require parental consent depending on their
        jurisdiction.
      </p>

      <h5>Your Responsibilities</h5>
      <ul className="list-disc list-outside pl-6">
        <li>
          Safe use: Avoid submitting sensitive personal information or
          confidential data through the service.
        </li>
        <li>
          Compliance: Ensure your use of the service complies with applicable
          laws and regulations.
        </li>
      </ul>

      <h5>Changes to This Policy</h5>
      <p>
        We may update this Privacy and Security Policy from time to time. Any
        changes will be reflected here with an updated effective date.
        Significant changes will be communicated directly to users.
      </p>
      <p className="text-muted-foreground">Policy last updated: 18 Sept 2025</p>
    </ContentGroup>
  );
}
