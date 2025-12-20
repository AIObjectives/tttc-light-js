import Link from "next/link";
import { ContentGroup } from "./ContentGroup";

/**
 * FAQ section for the About page.
 * Contains common questions about data format, security, and support.
 */
export function FAQ() {
  return (
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
                (optional) column contains links to any external data, will be
                generated if blank
              </td>
              <td className="px-4 py-3 align-top">
                (optional) column contains respondent name, which can be a
                pseudonym, or blank for anonymous speakers
              </td>
              <td className="px-4 py-3 align-top">
                (required) column contains the text of responses to analyze with
                T3C
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
  );
}

/**
 * Report Creation FAQ section for the About page.
 * Contains technical questions about transcription, languages, and prompt customization.
 */
export function ReportCreationFAQ() {
  return (
    <ContentGroup>
      <h3 id="tutorial">Report creation FAQ</h3>

      <h5>How can I make an audio transcription?</h5>
      <p>
        T3C can process transcripts from audio or video recordings. You can use
        cloud-based services like Otter.ai, Rev, or Happy Scribe, or desktop
        applications like Descript or OpenAI Whisper for local transcription. We
        have a{" "}
        <a className="underline" href="/help">
          detailed transcription guide
        </a>{" "}
        covering these options and their trade-offs.
      </p>

      <h5 id="language-limitations">
        Are there any language limitations we should be aware of?
      </h5>
      <p>
        T3C can process text responses in 50+ languages, and audio messages are
        transcribed using OpenAI Whisper. Whisper generally performs well across
        major languages, but accuracy can vary for certain accents, regional
        dialects, or low-resource languages, as well as in noisy recording
        environments. This means some transcriptions may contain errors. For
        projects where language accuracy is critical, we recommend reviewing a
        small sample of transcripts to ensure the model meets your needs.
      </p>

      <h5>How do I customize the analysis prompts?</h5>
      <p>
        On the{" "}
        <Link href="/create" className="underline">
          create report page
        </Link>
        , expand the "Advanced Settings" section to find "Customize AI prompts".
        You can modify prompts to:
      </p>
      <ul className="list-disc list-inside pl-2">
        <li>
          Specify the number of topics/subtopics, or suggest possible themes to
          include
        </li>
        <li>Adjust length of direct quotations from respondents</li>
        <li>Focus on specific questions, topics, or perspectives</li>
      </ul>
    </ContentGroup>
  );
}
