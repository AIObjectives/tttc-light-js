export const defaultSystemPrompt = `You are a professional research assistant. You have helped run many public consultations, 
surveys and citizen assemblies. You have good instincts when it comes to extracting interesting insights. 
You are familiar with public consultation tools like Pol.is and you understand the benefits 
for working with very clear, concise claims that other people would be able to vote on.`;

export const defaultClusteringPrompt = `I will give you a list of comments.
I want you to propose a way to break down the information contained in these comments into topics and subtopics of interest. 
Keep the topic and subtopic names very concise and use the short description to explain what the topic is about.

Return a JSON object of the form {
  "taxonomy": [
    {
      "topicName": string,
      "topicShortDescription": string (max 30 words),
      "subtopics": [
        {
          "subtopicName": string,
          "subtopicShortDescription": string (max 80 words),
        },
        ...
      ]
    },
    ...
  ]
}

Now here is the list of comments:
\${comments}
`;

export const defaultExtractionPrompt = `I'm going to give you a comment made by a participant and a list of topics and subtopics which have already been extracted.
I want you to extract the most important concise claims that the participant may support.
We are only interested in claims that can be mapped to one of the given topic and subtopic.
The claim must be fairly general but not a platitude.
It must be something that other people may potentially disagree with. Each claim must also be atomic.

CRITICAL EXTRACTION RULES - STRICT ENFORCEMENT:
1. Extract ZERO claims for comments that are vague, meandering, or lack a clear point
2. Extract ZERO claims for anecdotes without a broader principle
3. Extract multiple claims if the comment contains distinct, substantial debatable positions, but treat similar points as variations of one claim rather than separate claims
4. ONLY extract claims that represent genuinely debatable positions
5. DO NOT extract claims that are:
   - Platitudes or truisms ("communication is important")
   - Mere descriptions of experiences without advocating a position
   - Minor variations of the same underlying idea
   - Questions or musings without clear stances

QUALITY THRESHOLD: If you're unsure whether a comment contains a substantial claim worth extracting, err on the side of extracting NOTHING. It's better to miss marginal claims than to create noise.

For each claim, please also provide a relevant quote from the transcript.
The quote must be as concise as possible while still supporting the argument.
The quote doesn't need to be a logical argument.
It could also be a personal story or anecdote illustrating why the interviewee would make this claim.
You may use "[...]" in the quote to skip the less interesting bits of the quote.

Return a JSON object of the form {
  "claims": [
    {
      "claim": string, // a very concise extracted claim
      "quote": string // the exact quote,
      "topicName": string // from the given list of topics
      "subtopicName": string // from the list of subtopics
    }
  ]
}

Now here is the list of topics/subtopics:
\${taxonomy}

And then here is the comment:
\${comment} `;

export const defaultDedupPrompt = `You are grouping claims to help users understand which themes matter most in this consultation. Your goal is to consolidate similar claims into well-supported groups while preserving genuinely unique perspectives.

You will receive a list of claims with IDs, claim text, and quote text for each.

GROUPING DECISION FRAMEWORK:

Step 1 - Identify Core Themes:
Ask yourself: "What are the 3-5 main ideas or concerns being expressed across ALL these claims?"
These themes become your candidate groups.

Step 2 - Apply Grouping Criteria:
Group claims together if they share ANY of these:
✓ Same underlying concern or problem (even if different solutions proposed)
✓ Same recommendation or solution (even if different reasoning)
✓ Same value or principle being expressed
✓ Different aspects of the same topic (e.g., "cost too high" + "pricing unclear" = pricing concerns)
✓ Specific examples of a general pattern

Keep claims separate ONLY if:
✗ They address completely different topics within this subtopic
✗ They represent opposing positions (agree vs disagree on something)
✗ One is about process/how, the other is about outcome/what

Step 3 - Write Strong Group Claims:
For each group, write a claim that:
- Captures the shared essence at a higher level of abstraction
- Uses language and concepts that appear in the original claims (avoid introducing new terminology)
- Is specific enough to be meaningful (avoid vague platitudes like "improve X")
- Could plausibly be supported by all quotes in the group
- Uses clear, simple language
- Stays faithful to what participants actually said

Step 4 - Validate Your Groups:
- Prioritize natural thematic coherence over hitting specific group counts
- Each group should represent a distinct, meaningful theme
- Single-claim groups should be relatively uncommon - if you have many, consider whether you're missing higher-level themes that connect claims
- Avoid over-consolidation: don't force claims together just to reduce group count
- The right number of groups depends on the natural diversity of perspectives in the input

EXAMPLES OF GOOD GROUPING:

Input claims:
- "Parking fees are too expensive"
- "The parking pass system is confusing"
- "We need more parking spaces"

Good grouped claim: "Parking access and affordability need improvement"
Why: All three address parking as a barrier, even though they emphasize different aspects.

Input claims:
- "We should prioritize renewable energy"
- "The city should ban plastic bags"

Bad grouping: "Environmental initiatives needed"
Why: These are different environmental policies that shouldn't be lumped together just because they're both environmental.

Return a JSON object of the form {
  "groupedClaims": [
    {
      "claimText": "A higher-level claim that represents all quotes in this group",
      "originalClaimIds": ["claimId1", "claimId3", "claimId5"]
    }
  ]
}

Now here are the claims to group:
\${claims}`;

export const defaultSummariesPrompt = `I'm going to give you a JSON object containing a list of topics with their descriptions, subtopics, and claims.
For each topic I want you to generate a detailed summary of the subtopics and claims for that topic. The summary
should not exceed 140 words.

Return a JSON object in the form {
  "summaries": [
    {
      "topicName": string, // from the given list of topics
      "summary": string // max 140 words
    }
  ]
}

And now here are the topics:
\${topics}
`;

/**
 * Crux extraction prompt (applied per subtopic, not per topic)
 *
 * Note: The prompt uses "topic" terminology for simplicity, but this is actually
 * applied to each SUBTOPIC individually. The code passes "Topic, Subtopic" as the
 * topic name and only includes claims from that specific subtopic.
 */
export const defaultCruxPrompt = `I'm going to give you a topic with a description and a list of high-level claims about this topic made by different participants,
identified by pseudonyms like "Person 1" or "A". I want you to formulate a new, specific statement called a "cruxClaim"
which would best split the participants into two groups, based on all their
statements on this topic: one group which would agree with the statement, and one which would disagree.
Please explain your reasoning and assign participants into "agree" and "disagree" groups.
return a JSON object of the form
{
  "crux" : {
    "cruxClaim" : string // the new extracted claim
    "agree" : list of strings // list of the given participants who would agree with the cruxClaim
    "disagree" : list strings // list of the given participants who would disagree with the cruxClaim
    "explanation" : string // reasoning for why you synthesized this cruxClaim from the participants' perspective
  }
}`;

/**
 * Takes a prompt and data, and then inserts those values into the prompt.
 * The reason for this is that the string the user provides can't actually be a template literal.
 *
 * Be careful to make sure your dataObj contains the correct fields that match the correct ${vars}
 */
export function hydratePromptLiterals(prompt: string, dataObj: any): string {
  try {
    const templateFn = Function(
      ...Object.keys(dataObj),
      `return \`${prompt}\`;`,
    );
    return templateFn(...Object.values(dataObj));
  } catch (e) {
    return "Error hydrating prompt with variables";
  }
}
