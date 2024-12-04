#! usr/bin/env python

# cheapest for testing 
MODEL = "gpt-4o-mini" # prod default: "gpt-4-turbo-preview"

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

WANDB_PROJECT_NAME = "t3c_llm_tree"
