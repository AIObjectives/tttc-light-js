export default function SafetyRedesign() {
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
        Understanding AI Risks
      </h1>
    </section>
  );
}

function ContentSection() {
  return (
    <section className="px-8 lg:px-28 pb-16">
      <IntroBlock />
      <MitigationsSection />
      <RemainingRisksSection />
      <HumanOversightSection />
    </section>
  );
}

function IntroBlock() {
  return (
    <div>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        Talk to the City uses Large Language Models (LLMs) to strengthen
        collective decision-making by transforming large-scale public input into
        actionable insights. Unlike traditional polling or commercial survey
        tools, T3C preserves the nuance of individual perspectives and captures
        authentic voices, while surfacing the broader themes and differences
        that matter most. Like all AI systems, LLMs have limitations and risks
        that users should understand.
      </p>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        LLMs excel at recognizing language patterns, identifying themes, and
        summarizing complex information. However, they are prediction machines,
        not truth machines. They generate text based on patterns they have
        learned, not from verified facts. When an LLM produces text that sounds
        plausible but is not grounded in source materials, it is called a
        &ldquo;hallucination.&rdquo;
      </p>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        In the context of summarizing large opinion datasets, this might mean:
      </p>
      <ul className="list-disc text-xl font-normal text-muted-foreground leading-[31px] mb-10 ml-8 space-y-1 max-w-5xl">
        <li>
          <span className="font-medium">Invented claims:</span> Generating
          statements no participants actually made.
        </li>
        <li>
          <span className="font-medium">Overgeneralization:</span> Expanding a
          specific statement (&ldquo;I love my German Shepherd&rdquo;) into a
          broad conclusion (&ldquo;People prefer large dog breeds&rdquo;).
        </li>
        <li>
          <span className="font-medium">Unwarranted assumptions:</span>{" "}
          Inferring motivations or beliefs that were not expressed.
        </li>
        <li>
          <span className="font-medium">Misattributed quotes:</span> Pairing
          quotes with claims they do not support.
        </li>
      </ul>
    </div>
  );
}

function MitigationsSection() {
  return (
    <div>
      <h2 className="text-3xl font-semibold tracking-tight leading-9 mt-16 mb-4">
        How Talk to the City Mitigates Hallucinations
      </h2>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        We have built Talk to the City with multiple safeguards and validation
        steps into the processing pipeline to mitigate these risks.
      </p>

      <h3 className="text-xl font-medium text-muted-foreground leading-[31px] mb-2">
        Claim Extraction with Constrained Output
      </h3>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        For each comment, the LLM extracts explicit claims and must link them to
        verbatim quotes from real people that support each claim. The LLM can
        only use topic and subtopic names generated during the initial
        extraction phase—no variations or new names are allowed.
      </p>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        Short comments (fewer than three words) are filtered out because they
        can cause the LLM to hallucinate by inventing missing details.
      </p>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        Each extracted claim in a Talk to the City report is directly traceable
        to real people&apos;s opinions. Clicking a claim reveals the exact
        supporting quotes and participants behind it to verify whether the
        summary is fair and accurate.
      </p>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        We also use automated tests to flag low-quality extractions:
      </p>
      <ul className="list-disc text-xl font-normal text-muted-foreground leading-[31px] mb-10 ml-8 space-y-1 max-w-5xl">
        <li>
          Overly generic claims (&ldquo;communication is important&rdquo;)
        </li>
        <li>
          Personal preferences that are too vague to contribute to deliberation
          on the subject (e.g. &ldquo;I like cats&rdquo; in a report on the
          ethics of pet ownership)
        </li>
        <li>Mismatched or incomplete quotes</li>
      </ul>

      <h3 className="text-xl font-medium text-muted-foreground leading-[31px] mb-2">
        Transparency and Auditability
      </h3>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        Every report also includes a detailed audit log of all processing
        decisions, showing:
      </p>
      <ul className="list-disc text-xl font-normal text-muted-foreground leading-[31px] mb-4 ml-8 space-y-1 max-w-5xl">
        <li>
          <span className="font-medium">Filtering:</span> Which comments were
          excluded (too short, etc) and why
        </li>
        <li>
          <span className="font-medium">Deduplication:</span> Which claims were
          merged and why
        </li>
        <li>
          <span className="font-medium">Extraction results:</span> Success,
          errors, or flagged issues
        </li>
        <li>
          <span className="font-medium">Metadata:</span> Timestamps, model
          versions, and configuration details
        </li>
      </ul>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-10">
        This enables full traceability. If you discover a possible hallucination
        or misclassification, please report it through{" "}
        <a
          href="mailto:t3c@objective.is"
          className="text-indigo-600 hover:underline"
        >
          t3c@objective.is
        </a>
        .
      </p>
    </div>
  );
}

function RemainingRisksSection() {
  return (
    <div>
      <h2 className="text-3xl font-semibold tracking-tight leading-9 mt-16 mb-4">
        Remaining Risks
      </h2>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        Despite our safeguards, some risks remain:
      </p>

      <h3 className="text-xl font-medium text-muted-foreground leading-[31px] mb-2">
        Subtle Overgeneralization
      </h3>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        The AI might slightly exaggerate or reframe a sentiment. For example:
      </p>
      <ul className="list-disc text-xl font-normal text-muted-foreground leading-[31px] mb-4 ml-8 space-y-1 max-w-5xl">
        <li>Comment: &ldquo;I&apos;m not sure about birds&rdquo;</li>
        <li>Claim: &ldquo;Birds are not ideal pets for everyone&rdquo;</li>
      </ul>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        The claim adds certainty not present in the original comment.
      </p>

      <h3 className="text-xl font-medium text-muted-foreground leading-[31px] mb-2">
        Topic Sorting Ambiguity
      </h3>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        LLM topic sorting may differ from human intuition, occasionally merging
        or fragmenting categories in unexpected ways.
      </p>

      <h3 className="text-xl font-medium text-muted-foreground leading-[31px] mb-2">
        Missing Edge Cases
      </h3>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        Niche or minority perspectives can be underrepresented or absorbed into
        broader themes.
      </p>

      <h3 className="text-xl font-medium text-muted-foreground leading-[31px] mb-2">
        Bias Inheritance
      </h3>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-4">
        Because LLMs reflect patterns in their training data, they may reproduce
        cultural or societal biases in phrasing or emphasis. To make the most of
        your report, stay alert to two types of potential issues:
      </p>
      <ol className="list-decimal text-xl font-normal text-muted-foreground leading-[31px] mb-4 ml-8 space-y-2 max-w-5xl">
        <li>
          <span className="font-medium">AI Interpretation Limits:</span> These
          relate to how language models interpret or summarize text.
          <ul className="list-disc ml-6 mt-1 space-y-1">
            <li>
              Quotes that don&apos;t clearly support the claims they are
              attached to.
            </li>
            <li>
              Vague or ambiguous comments turned into confident or detailed
              statements.
            </li>
          </ul>
        </li>
        <li>
          <span className="font-medium">Underlying Data Gaps:</span> These arise
          from limitations in the input itself—such as low participation, uneven
          representation, or missing perspectives. AI analysis cannot correct
          for these gaps.
          <ul className="list-disc ml-6 mt-1 space-y-1">
            <li>Topics supported by very few quotes or contributors.</li>
            <li>Overly uniform consensus with no visible disagreement.</li>
            <li>Missing or underrepresented viewpoints you expected to see.</li>
          </ul>
        </li>
      </ol>
    </div>
  );
}

function HumanOversightSection() {
  return (
    <div>
      <h2 className="text-3xl font-semibold tracking-tight leading-9 mt-16 mb-4">
        Human Oversight Matters
      </h2>
      <p className="text-xl font-normal text-muted-foreground leading-[31px] max-w-5xl mb-10">
        Think of Talk to the City as a highly capable research assistant: fast,
        consistent, and insightful, but still requiring human oversight and
        judgment. Use reports as a starting point for conversation, not the
        final conclusion. Verify key claims, examine original quotes, and apply
        your contextual knowledge. Our goal is to help make your community voice
        easier to hear—clearly, honestly, and with full awareness of
        technological limits.
      </p>
    </div>
  );
}
