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
      "topicShortDescription": string (max 30 characters),
      "subtopics": [
        {
          "subtopicName": string,
          "subtopicShortDescription": string (max 140 characters),
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
I want you to extract a list of concise claims that the participant may support.
We are only interested in claims that can be mapped to one of the given topic and subtopic. 
The claim must be fairly general but not a platitude. 
It must be something that other people may potentially disagree with. Each claim must also be atomic. 
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
    }, 
    // ... 
  ]
}

Now here is the list of topics/subtopics: 
\${taxonomy}

And then here is the comment:
\${comment} `;

export const defaultDedupPrompt = `I'm going to give you a JSON object containing a list of claims with some ids.
I want you to remove any near-duplicate claims from the list by nesting some claims under some top-level claims. 
For example, if we have 5 claims and claim 3 and 5 are similar to claim 2, we will nest claim 3 and 5 under claim 2. 
The nesting will be represented as a JSON object where the keys are the ids of the 
top-level claims and the values are lists of ids of the nested claims.

Return a JSON object of the form {
  "nesting": {
    "claimId1": [], 
    "claimId2": ["claimId3", "claimId5"],
    "claimId4": []
  }
}

And now, here are the claims:
\${claims}`;

export const defaultSummariesPrompt = `
I'm going to give you a JSON object containing a list of topics with their descriptions, subtopics, and claims.
For each topic I want you to generate a detailed summary of the subtopics and claims for that topic. The summary
should not exceed 140 characters.

Return a JSON object in the form {
  "summaries": [
    {
      "topicName": string, // from the given list of topics
      "summary": string // max 140 characters
    }
  ]
}

And now here are the topics:
\${topics}
`;

export const defaultCruxPrompt = `
I'm going to give you a topic with a description and a list of high-level claims about this topic made by different participants,
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
