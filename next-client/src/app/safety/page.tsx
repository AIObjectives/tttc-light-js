import { Col } from "@/components/layout";
import { serverSideAnalyticsClient } from "@/lib/analytics/serverSideAnalytics";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "LLM Safety - Talk to the City",
  description:
    "Understanding AI risks and safety measures in Talk to the City reports",
};

const ContentGroup = ({ children }: React.PropsWithChildren) => (
  <Col gap={3}>{children}</Col>
);

const ContentGroupContainer = ({ children }: React.PropsWithChildren) => (
  <Col gap={6}>{children}</Col>
);

/**
 * LLM Safety Info and Disclaimers page for T3C
 */
export default async function SafetyPage() {
  try {
    const analytics = await serverSideAnalyticsClient();
    await analytics.page("LLM Safety");
  } catch (error) {
    // Log analytics failure but don't block page render
    console.error("Failed to track page view:", error);
  }

  return (
    <Col className="p-8 max-w-[832px] m-auto">
      <ContentGroupContainer>
        <ContentGroup>
          <h2>Understanding AI Risks in Talk to the City</h2>
          <p>
            Talk to the City uses Large Language Models (LLMs) to strengthen
            collective decision-making by transforming large-scale public input
            into actionable insights. Unlike traditional polling or commercial
            survey tools, T3C preserves the nuance of individual perspectives
            and captures authentic voices, while surfacing the broader themes
            and differences that matter most. Like all AI systems, LLMs have
            limitations and risks that users should understand.
          </p>
          <p>
            LLMs excel at recognizing language patterns, identifying themes, and
            summarizing complex information. However, they are prediction
            machines, not truth machines. They generate text based on patterns
            they have learned, not from verified facts. When an LLM produces
            text that sounds plausible but is not grounded in source materials,
            it is called a "hallucination."
          </p>
          <p>
            In the context of summarizing large opinion datasets, this might
            mean:
          </p>
          <ul className="list-disc list-outside pl-6">
            <li>
              <strong>Invented claims:</strong> Generating statements no
              participants actually made.
            </li>
            <li>
              <strong>Overgeneralization:</strong> Expanding a specific
              statement ("I love my German Shepherd") into a broad conclusion
              ("People prefer large dog breeds").
            </li>
            <li>
              <strong>Unwarranted assumptions:</strong> Inferring motivations or
              beliefs that were not expressed.
            </li>
            <li>
              <strong>Misattributed quotes:</strong> Pairing quotes with claims
              they do not support.
            </li>
          </ul>
        </ContentGroup>

        <ContentGroup>
          <h3>How Talk to the City Mitigates Hallucinations</h3>
          <p>
            We have built Talk to the City with multiple safeguards and
            validation steps into the processing pipeline to mitigate these
            risks:
          </p>

          <h4>Claim Extraction with Constrained Output</h4>
          <p>
            For each comment, the LLM extracts explicit claims and must link
            them to verbatim quotes from real people that support each claim.
            The LLM can only use topic and subtopic names generated during the
            initial extraction phase—no variations or new names are allowed.
          </p>
          <p>
            Short comments (fewer than three words) are filtered out because
            they can cause the LLM to hallucinate by inventing missing details.
          </p>
          <p>
            Each extracted claim in a Talk to the City report is directly
            traceable to real people's opinions. Clicking a claim reveals the
            exact supporting quotes and participants behind it to verify whether
            the summary is fair and accurate.
          </p>
          <p>We also use automated tests to flag low-quality extractions:</p>
          <ul className="list-disc list-outside pl-6">
            <li>Overly generic claims ("communication is important")</li>
            <li>
              Personal preferences that are too vague to contribute to
              deliberation on the subject (e.g. "I like cats" in a report on the
              ethics of pet ownership)
            </li>
            <li>Mismatched or incomplete quotes</li>
          </ul>

          <h4>Transparency and Auditability</h4>
          <p>
            Every report also includes a detailed audit log of all processing
            decisions, showing:
          </p>
          <ul className="list-disc list-outside pl-6">
            <li>
              <strong>Filtering:</strong> Which comments were excluded (too
              short, etc) and why
            </li>
            <li>
              <strong>Deduplication:</strong> Which claims were merged and why
            </li>
            <li>
              <strong>Extraction results:</strong> Success, errors, or flagged
              issues
            </li>
            <li>
              <strong>Metadata:</strong> Timestamps, model versions, and
              configuration details
            </li>
          </ul>
          <p>
            This enables full traceability. If you discover a possible
            hallucination or misclassification, please{" "}
            <a className="underline" href="mailto:hello@aiobjectives.org">
              report it
            </a>
            .
          </p>
        </ContentGroup>

        <ContentGroup>
          <h3>Remaining Risks</h3>
          <p>Despite our safeguards, some risks remain:</p>

          <h4>1. Subtle Overgeneralization</h4>
          <p>
            The AI might slightly exaggerate or reframe a sentiment. For
            example:
          </p>
          <ul className="list-disc list-outside pl-6">
            <li>Comment: "I'm not sure about birds"</li>
            <li>Claim: "Birds are not ideal pets for everyone"</li>
          </ul>
          <p>The claim adds certainty not present in the original comment.</p>

          <h4>2. Topic Sorting Ambiguity</h4>
          <p>
            LLM topic sorting may differ from human intuition, occasionally
            merging or fragmenting categories in unexpected ways.
          </p>

          <h4>3. Missing Edge Cases</h4>
          <p>
            Niche or minority perspectives can be underrepresented or absorbed
            into broader themes.
          </p>

          <h4>4. Bias Inheritance</h4>
          <p>
            Because LLMs reflect patterns in their training data, they may
            reproduce cultural or societal biases in phrasing or emphasis. To
            make the most of your report, stay alert to two types of potential
            issues:
          </p>
          <p>
            <strong>AI Interpretation Limits:</strong> These relate to how
            language models interpret or summarize text.
          </p>
          <ul className="list-disc list-outside pl-6">
            <li>
              Quotes that don't clearly support the claims they are attached to.
            </li>
            <li>
              Vague or ambiguous comments turned into confident or detailed
              statements.
            </li>
          </ul>
          <p>
            <strong>Underlying Data Gaps:</strong> These arise from limitations
            in the input itself—such as low participation, uneven
            representation, or missing perspectives. AI analysis cannot correct
            for these gaps.
          </p>
          <ul className="list-disc list-outside pl-6">
            <li>Topics supported by very few quotes or contributors.</li>
            <li>Overly uniform consensus with no visible disagreement.</li>
            <li>Missing or underrepresented viewpoints you expected to see.</li>
          </ul>
        </ContentGroup>

        <ContentGroup>
          <h3>Human Oversight Matters</h3>
          <p>
            Think of Talk to the City as a highly capable research assistant:
            fast, consistent, and insightful, but still requiring human
            oversight and judgment. Use reports as a starting point for
            conversation, not the final conclusion. Verify key claims, examine
            original quotes, and apply your contextual knowledge. Our goal is to
            help make your community voice easier to hear—clearly, honestly, and
            with full awareness of technological limits.
          </p>
        </ContentGroup>
      </ContentGroupContainer>
    </Col>
  );
}
