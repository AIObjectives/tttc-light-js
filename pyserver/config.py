#! usr/bin/env python

# DEV MODE DRY RUN: 
# - faster & cheaper testing
# - set this to True to skip OpenAI calls/paying for external LLMs
# - returns a fixed string in the correct shape for all pyserver routes
# which would typically call OpenAI
DRY_RUN = False

# cheapest for testing
MODEL = "gpt-4o-mini"  # prod default: "gpt-4-turbo-preview"

COST_BY_MODEL = {
    # GPT-4o mini: Input is $0.150 / 1M tokens, Output is $0.600 / 1M tokens
    # or: input is $0.00015/1K tokens, output is $0.0006/1K tokens
    "gpt-4o-mini": {"in_per_1K": 0.00015, "out_per_1K": 0.0006},
    # GPT-4o : Input is $2.50 / 1M tokens, Output is $10.00/1M tokens
    # or: input is $0.0025/1K tokens, output is $0.01/1K tokens
    "gpt-4o": {"in_per_1K": 0.0025, "out_per_1K": 0.01},
}

# for web-app mode, require at least 3 words in order to extract meaningful claims
MIN_WORD_COUNT_FOR_MEANING = 3
MIN_CHAR_COUNT_FOR_MEANING = 10

# ============================================================================
# PROMPTS - TEST-ONLY DEFAULTS
# ============================================================================
# NOTE: These prompts are ONLY used in test files (test_pipeline.py, etc.)
# Production API (main.py) receives prompts from the frontend via the API request.
# The source of truth for production prompts is: common/prompts/index.ts
#
# These should be kept in sync with common/prompts/index.ts for consistency,
# but they serve as convenient defaults for standalone Python testing.
# ============================================================================

SYSTEM_PROMPT = """
You are a professional research assistant. You have helped run many public consultations, surveys and citizen assemblies. You have good instincts when it comes to extracting interesting insights. You are familiar with public consultation tools like Pol.is and you understand the benefits for working with very clear, concise claims that other people would be able to vote on.
"""

COMMENT_TO_TREE_PROMPT = """
I will give you a list of comments. Please propose a way to organize the information contained in these comments into topics and subtopics of interest. Keep the topic and subtopic names very concise and use the short description to explain what the topic is about.

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
"""

COMMENT_TO_CLAIMS_PROMPT = """
I'm going to give you a comment made by a participant and a list of topics and subtopics which have already been extracted. I want you to extract the most important concise claims that the participant may support. We are only interested in claims that can be mapped to one of the given topic and subtopic. The claim must be fairly general but not a platitude. It must be something that other people may potentially disagree with. Each claim must also be atomic.

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

For each claim, please also provide a relevant quote from the transcript. The quote must be as concise as possible while still supporting the argument. The quote doesn't need to be a logical argument. It could also be a personal story or anecdote illustrating why the interviewee would make this claim. You may use "[...]" in the quote to skip the less interesting bits of the quote.

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

Now here is the list of topics/subtopics:"""
# also include in prompt:
# append ${taxonomy}
# comments: And then here is the comment:"""

CLAIM_DEDUP_PROMPT = """
You are grouping claims to help users understand which themes matter most in this consultation. Your goal is to consolidate similar claims into well-supported groups while preserving genuinely unique perspectives.

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

Now here are the claims to group:"""

TOPIC_SUMMARY_PROMPT = """
I'm going to give you a JSON object containing a list of topics with their descriptions, subtopics, and claims. 
For each topic I want you to generate a detailed summary of the subtopics and claims for that topic.  The summary
should not exceed 140 characters. 

Return a JSON object in the form {
    "summaries": [
        "topicName": string // from the given list of topics
        "summary": string // max 140 characters.
    ]
}

And now here are the topics:"""

CRUX_PROMPT = """
I'm going to give you a topic with a description and a list of high-level claims about this topic made by different participants, identified by numeric IDs (like 0, 1, 2, etc.). Please synthesize these claims into one new, specific, maximally controversial statement called a "cruxClaim". This cruxClaim should divide the participants into "agree" and "disagree" groups or sides, based on all their statements on this topic: one group which would agree with the statement, and one which would disagree.

For each participant who made claims in this subtopic, categorize them as:
- "agree": Would agree with the cruxClaim based on their statements
- "disagree": Would disagree with the cruxClaim based on their statements
- "no_clear_position": Mentioned the topic but didn't take a clear stance on this specific crux

Please explain your reasoning and assign participants into the three groups. Make the cruxClaim as precise and unique as possible to the given topic and comments, and pick a cruxClaim that best balances the "agree" and "disagree" sides, with close to the same number of participants on each side.

IMPORTANT: Format requirements for your response:
1. In the agree/disagree/no_clear_position lists, use ONLY the exact numeric IDs from the input (like 0, 1, 2)
2. Do NOT add prefixes like "Person" or "Participant" to these numeric IDs
3. In the explanation field, write in natural, reader-friendly language:
   - Use natural phrases like "several participants" or "some speakers" instead of listing IDs
   - Use "this claim" or "the statement" instead of technical terms like "cruxClaim"
   - Avoid programming conventions like "no_clear_position" - use "didn't take a clear stance"
   - Write as if explaining to a general audience, not developers

Example of GOOD explanation:
"Several participants believe that universal healthcare should be implemented immediately, while others argue that a gradual transition is more practical. One participant didn't take a clear stance on the timeline."

Example of BAD explanation:
"The cruxClaim divides participants into agree/disagree groups. Participants 0, 1 agree with the cruxClaim. Participants 2, 3 are in the disagree group. Participant 4 has no_clear_position."

return a JSON object of the form
{
  "crux" : {
    "cruxClaim" : string // the new extracted claim
    "agree" : list of strings // list of the given participants who would agree with the cruxClaim
    "disagree" : list strings // list of the given participants who would disagree with the cruxClaim
    "no_clear_position" : list of strings // list of the given participants who mentioned the topic but took no clear stance
    "explanation" : string // natural language explanation of why this is a point of controversy, written for general readers (avoid listing IDs, use phrases like "several participants")
  }
}
"""

WANDB_PROJECT_NAME = ""
WANDB_GROUP_LOG_NAME = ""

MOCK_RESPONSE = {
    "topic_tree": {
        "data": [
            {
                "topicName": "Pets",
                "topicShortDescription": "General opinions about common household pets.",
                "subtopics": [
                    {
                        "subtopicName": "Cats",
                        "subtopicShortDescription": "Positive sentiments towards cats as pets.",
                    },
                    {
                        "subtopicName": "Dogs",
                        "subtopicShortDescription": "Positive sentiments towards dogs as pets.",
                    },
                    {
                        "subtopicName": "Birds",
                        "subtopicShortDescription": "Uncertainty or mixed feelings about birds as pets.",
                    },
                ],
            },
        ],
        "usage": {"completion_tokens": 131, "prompt_tokens": 224, "total_tokens": 355},
        "cost": 0.0,
    },
    "claims": {
        "data": {
            "Pets": {
                "total": 3,
                "subtopics": {
                    "Cats": {
                        "total": 1,
                        "claims": [
                            {
                                "claim": "Cats are the best household pets.",
                                "commentId": "c1",
                                "quote": "I love cats",
                                "topicName": "Pets",
                                "speaker": "Alice",
                                "subtopicName": "Cats",
                            },
                        ],
                    },
                    "Dogs": {
                        "total": 1,
                        "claims": [
                            {
                                "claim": "Dogs are superior pets.",
                                "commentId": "c2",
                                "quote": "dogs are great",
                                "topicName": "Pets",
                                "speaker": "Bob",
                                "subtopicName": "Dogs",
                            },
                        ],
                    },
                    "Birds": {
                        "total": 1,
                        "claims": [
                            {
                                "claim": "Birds are not suitable pets for everyone.",
                                "commentId": "c3",
                                "quote": "I'm not sure about birds.",
                                "topicName": "Pets",
                                "speaker": "Charles",
                                "subtopicName": "Birds",
                            },
                        ],
                    },
                },
            },
        },
        "usage": {
            "completion_tokens": 163,
            "prompt_tokens": 1412,
            "total_tokens": 1575,
        },
        "cost": 0.0,
    },
    "dedup": {
        "data": [
            {
                "claim": "Birds are not ideal pets for everyone.",
                "commentId": "c3",
                "quote": "I'm not sure about birds.",
                "speaker": "Charles",
                "topicName": "Pets",
                "subtopicName": "Birds",
                "duplicates": [
                    {
                        "claim": "Birds are not suitable pets for everyone.",
                        "commentId": "c3",
                        "quote": "I don't know about birds.",
                        "speaker": "Dany",
                        "topicName": "Pets",
                        "subtopicName": "Birds",
                        "duplicated": True,
                    }
                ],
            }
        ],
        "usage": {"completion_tokens": 131, "prompt_tokens": 224, "total_tokens": 355},
        "cost": 0.0,
    },
    "sort_claims_tree": {
        "data": [
            [
                "Pets",
                {
                    "topics": [
                        [
                            "Cats",
                            {
                                "claims": [
                                    {
                                        "claim": "Cats are the best pets.",
                                        "quote": "I love cats",
                                        "speaker": "Alice",
                                        "topicName": "Pets",
                                        "subtopicName": "Cats",
                                        "commentId": "1",
                                    }
                                ],
                                "speakers": ["Alice"],
                                "counts": {"claims": 1, "speakers": 1},
                            },
                        ],
                        [
                            "Dogs",
                            {
                                "claims": [
                                    {
                                        "claim": "Dogs are the best pets.",
                                        "quote": "I really really love dogs",
                                        "speaker": "Bob",
                                        "topicName": "Pets",
                                        "subtopicName": "Dogs",
                                        "commentId": "2",
                                    }
                                ],
                                "speakers": ["Bob"],
                                "counts": {"claims": 1, "speakers": 1},
                            },
                        ],
                        [
                            "Birds",
                            {
                                "claims": [
                                    {
                                        "claim": "Birds are not as appealing as other pets.",
                                        "quote": "I am not sure about birds.",
                                        "speaker": "Charles",
                                        "topicName": "Pets",
                                        "subtopicName": "Birds",
                                        "commentId": "3",
                                    }
                                ],
                                "speakers": ["Charles"],
                                "counts": {"claims": 1, "speakers": 1},
                            },
                        ],
                    ],
                    "speakers": ["Bob", "Alice", "Charles"],
                    "counts": {"claims": 3, "speakers": 3},
                },
            ]
        ],
        "usage": {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0},
        "cost": 0.0,
    },
    "cruxes": {
        "cruxClaims": [
            {
                "cruxClaim": "Epic fantasy storytelling should prioritize expansive worlds and detailed character backgrounds.",
                "agree": ["Alice"],
                "disagree": ["Dany"],
                "explanation": "The cruxClaim synthesizes the desire for expansive fantasy settings and the importance of character backgrounds. Participant 0 emphasizes the need for greater emphasis on epic fantasy worlds, indicating a preference for immersive settings. In contrast, Participant 3 focuses specifically on the inclusion of royal lineage as a character's background, which suggests a narrower view that does not necessarily align with the broader desire for expansive worlds. Thus, Participant 0 agrees with the cruxClaim, while Participant 3 disagrees.",
            },
            {
                "cruxClaim": "Characters in fantasy should possess unique powers that enhance their individuality and connection to the universe.",
                "agree": ["Elinor", "Dany"],
                "disagree": [],
                "explanation": "Both participants emphasize the importance of unique powers in enhancing character individuality and their connection to the universe. Participant 4 explicitly states that characters should have unique powers that connect them to the universe, while Participant 3 believes that magical elements should enhance character individuality. Since both claims align closely with the cruxClaim, they agree with it. There are no participants who disagree, as all statements support the idea of unique powers contributing to individuality and a connection to the universe.",
            },
        ],
        "controversyMatrix": [[0, 2], [2, 0]],
        "topCruxes": [{
            "score": 2,
            "cruxA": "Epic fantasy storytelling should prioritize expansive worlds and detailed character backgrounds.",
            "cruxB": "Characters in fantasy should possess unique powers that enhance their individuality and connection to the universe.",
        }],
        "usage": {"completion_tokens": 0, "prompt_tokens": 0, "total_tokens": 0},
        "cost": 0.0,
    },
}
