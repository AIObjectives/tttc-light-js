#! usr/bin/env python

# cheapest for testing 
MODEL = "gpt-4o-mini" # prod default: "gpt-4-turbo-preview"

COST_BY_MODEL = {
  # GPT-4o mini: Input is $0.150 / 1M tokens, Output is $0.600 / 1M tokens
  # or: input is $0.00015/1K tokens, output is $0.0006/1K tokens
  "gpt-4o-mini" : {
    "in_per_1K" : 0.00015,
    "out_per_1K" : 0.0006
  },
  # GPT-4o : Input is $2.50 / 1M tokens, Output is $10.00/1M tokens
  # or: input is $0.0025/1K tokens, output is $0.01/1K tokens
  "gpt-4o" : {
    "in_per_1K" : 0.0025,
    "out_per_1K" : 0.01
  }
}

SYSTEM_PROMPT = """
You are a professional research assistant. You have helped run many public consultations,
surveys and citizen assemblies. You have good instincts when it comes to extracting interesting insights.
You are familiar with public consultation tools like Pol.is and you understand the benefits
for working with very clear, concise claims that other people would be able to vote on.
"""

COMMENT_TO_TREE_PROMPT = """
I will give you a list of comments.
Please propose a way to organize the information contained in these comments into topics and subtopics of interest.
Keep the topic and subtopic names very concise and use the short description to explain what the topic is about.

Return a JSON object of the form {
  "taxonomy": [
    {
      "topicName": string,
      "topicShortDescription": string,
      "subtopics": [
        {
          "subtopicName": string,
          "subtopicShortDescription": string,
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
I'm going to give you a comment made by a participant and a list of topics and subtopics which have already been extracted.
I want you to extract a list of concise claims that the participant may support.
We are only interested in claims that can be mapped to one of the given topic and subtopic.
The claim must be fairly general but not a platitude.
It must be something that other people may potentially disagree with. Each claim must also be atomic.
For each claim, please also provide a relevant quote from the transcript.
The quote must be as concise as possible while still supporting the argument.
The quote doesn't need to be a logical argument.
It could also be a personal story or anecdote illustrating why the interviewee would make this claim.
You may use "[...]" in the quote to skip the less interesting bits of the quote.
/return a JSON object of the form {
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

Now here is the list of topics/subtopics:"""
# also include in prompt:
# append ${taxonomy}
# comments: And then here is the comment:"""

CLAIM_DEDUP_PROMPT = """
I'm going to give you a JSON object containing a list of claims with some ids.
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

And now, here are the claims:"""

CRUX_PROMPT = """
I'm going to give you a topic with a description and a list of high-level claims about this topic made by different participants,
identified by pseudonyms like "Person 1" or "A". Please synthesize these claims into one new, specific, maximally controversial
statement called a "cruxClaim". This cruxClaim should divide the participants into "agree" and "disagree" groups or sides,
based on all their statements on this topic: one group which would agree with the statement, and one which would disagree.
Please explain your reasoning and assign participants into "agree" and "disagree" groups.
Make the cruxClaim as precise and unique as possible to the given topic and comments, and pick a cruxClaim that best balances the
"agree" and "disagree" sides, with close to the same number of participants on each side.

return a JSON object of the form
{
  "crux" : {
    "cruxClaim" : string // the new extracted claim
    "agree" : list of strings // list of the given participants who would agree with the cruxClaim
    "disagree" : list strings // list of the given participants who would disagree with the cruxClaim
    "explanation" : string // reasoning for why you synthesized this cruxClaim from the participants' perspective
  }
}
"""

WANDB_PROJECT_NAME = ""
WANDB_GROUP_LOG_NAME = ""
