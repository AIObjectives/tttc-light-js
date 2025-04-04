#!/usr/bin/env python

########################################
# T3C Pyserver: LLM Pipeline in Python #
# --------------------------------------#
"""A minimal FastAPI Python server calling the T3C LLM pipeline.

Each pipeline call assumes the client has already included
any user edits of the LLM configuration, including the model
name to use, the system prompt, and the specific pipeline step prompts.

Currently only supports OpenAI (Anthropic soon!!!)
For local testing, load these from a config.py file
"""

import json
from json import JSONDecodeError
import math
import os
import sys
from pathlib import Path
from typing import List

import wandb
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import APIKeyHeader
from openai import OpenAI
from pydantic import BaseModel

# Add the current directory to path for imports
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))
import config
from utils import cute_print, full_speaker_map, token_cost, topic_desc_map

load_dotenv()

app = FastAPI()
header_scheme = APIKeyHeader(name="openai-api-key")

# ! Temporarily including API key in env
api_key: str = os.getenv("OPENAI_API_KEY")

if api_key is None:
    raise Exception("No OpenAI API key present")

class Comment(BaseModel):
    id: str
    text: str
    speaker: str


class CommentList(BaseModel):
    comments: List[Comment]


class LLMConfig(BaseModel):
    model_name: str
    system_prompt: str
    user_prompt: str


class CommentsLLMConfig(BaseModel):
    comments: List[Comment]
    llm: LLMConfig


class CommentTopicTree(BaseModel):
    comments: List[Comment]
    llm: LLMConfig
    tree: dict


class ClaimTreeLLMConfig(BaseModel):
    tree: dict
    llm: LLMConfig
    sort: str


class CruxesLLMConfig(BaseModel):
    crux_tree: dict
    llm: LLMConfig
    topics: list
    top_k: int

@app.get("/")
def read_root():
    # TODO: setup/relevant defaults?
    return {"Hello": "World"}

###################################
# Step 1: Comments to Topic Tree  #
# ---------------------------------#
@app.post("/topic_tree")
def comments_to_tree(
    req: CommentsLLMConfig,
    api_key: str = Depends(header_scheme),
    log_to_wandb: str = config.WANDB_GROUP_LOG_NAME,
    dry_run=False,
) -> dict:
    """Given the full list of comments, return a corresponding taxonomy of relevant topics and their
    subtopics, with a short description for each.

    Input format:
    - CommentLLMConfig object: JSON/dictionary with the following fields:
      - comments: a list of Comment (each has a field, "text", for the raw text of the comment, and an id)
      - llm: a dictionary of the LLM configuration:
        - model_name: a string of the name of the LLM to call ("gpt-4o-mini", "gpt-4-turbo-preview")
        - system_prompt: a string of the system prompt
        - user_prompt: a string of the user prompt to convert the raw comments into the
                             taxonomy/topic tree
    Example:
    {
      "llm": {
          "model_name": "gpt-4o-mini",
          "system_prompt": "\n\tYou are a professional research assistant.",
          "topic_tree_prompt": "\nI will give you a list of comments."
      },
      "comments": [
          {
              "id": "c1",
              "text": "I love cats"
          },
          {
              "id": "c2",
              "text": "dogs are great"
          },
          {
              "id": "c3",
              "text": "I'm not sure about birds"
          }
      ]
    }

    Output format:
    - data : the tree as a dictionary
      - taxonomy : a key mapping to a list of topics, where each topic has
        - topicName: a string of the short topic title
        - topicShortDescription: a string of a short description of the topic
        - subtopics: a list of the subtopics of this main/parent topic, where each subtopic has
          - subtopicName: a string of the short subtopic title
          - subtopicShortDescription: a string of a short description of the subtopic
    - usage: a dictionary of token counts
      - completion_tokens
      - prompt_tokens
      - total_tokens

    Example output:
    {
      "data": {
          "taxonomy": [
              {
                  "topicName": "Pets",
                  "topicShortDescription": "General opinions about common household pets.",
                  "subtopics": [
                      {
                          "subtopicName": "Cats",
                          "subtopicShortDescription": "Positive sentiments towards cats as pets."
                      },
                      {
                          "subtopicName": "Dogs",
                          "subtopicShortDescription": "Positive sentiments towards dogs as pets."
                      },
                      {
                          "subtopicName": "Birds",
                          "subtopicShortDescription": "Uncertainty or mixed feelings about birds as pets."
                      }
                  ]
              }
          ]
      },
      "usage": {
          "completion_tokens": 131,
          "prompt_tokens": 224,
          "total_tokens": 355
      }
    }
    """
    # skip calling an LLM
    if dry_run or config.DRY_RUN:
        print("dry_run topic tree")
        return config.MOCK_RESPONSE["topic_tree"]

    if not api_key:
        raise HTTPException(status_code=401)
    client = OpenAI(api_key=api_key)

    # append comments to prompt
    full_prompt = req.llm.user_prompt
    for comment in req.comments:
        full_prompt += "\n" + comment.text

    response = client.chat.completions.create(
        model=req.llm.model_name,
        messages=[
            {"role": "system", "content": req.llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    try:
        tree = json.loads(response.choices[0].message.content)
    except Exception:
        print("Step 1: no topic tree: ", response)
        tree = {}
    usage = response.usage
    # compute LLM costs for this step's tokens
    s1_total_cost = token_cost(
        req.llm.model_name, usage.prompt_tokens, usage.completion_tokens,
    )

    if log_to_wandb:
        try:
            exp_group_name = str(log_to_wandb)
            wandb.init(
                project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
            )
            wandb.config.update(
                {
                    "s1_topics/model": req.llm.model_name,
                    "s1_topics/user_prompt": req.llm.user_prompt,
                    "s1_topics/system_prompt": req.llm.system_prompt,
                },
            )
            comment_lengths = [len(c.text) for c in req.comments]
            num_topics = len(tree["taxonomy"])
            subtopic_bins = [len(t["subtopics"]) for t in tree["taxonomy"]]

            # in case comments are empty / for W&B Table logging
            comment_list = "none"
            if len(req.comments) > 1:
                comment_list = "\n".join([c.text for c in req.comments])
            comms_tree_list = [[comment_list, json.dumps(tree["taxonomy"], indent=1)]]
            wandb.log(
                {
                    "comm_N": len(req.comments),
                    "comm_text_len": sum(comment_lengths),
                    "comm_bins": comment_lengths,
                    "num_topics": num_topics,
                    "num_subtopics": sum(subtopic_bins),
                    "subtopic_bins": subtopic_bins,
                    "rows_to_tree": wandb.Table(
                        data=comms_tree_list, columns=["comments", "taxonomy"],
                    ),
                    # token counts
                    "U_tok_N/taxonomy": usage.total_tokens,
                    "U_tok_in/taxonomy": usage.prompt_tokens,
                    "U_tok_out/taxonomy": usage.completion_tokens,
                    "cost/s1_topics": s1_total_cost,
                },
            )
        except Exception:
            print("Failed to create wandb run")
    # NOTE:we could return a dictionary with one key "taxonomy", or the raw taxonomy list directly
    # choosing the latter for now
    return {
        "data": tree["taxonomy"],
        "usage": usage.model_dump(),
        "cost": s1_total_cost,
    }


def comment_to_claims(llm: dict, comment: str, tree: dict, api_key: str) -> dict:
    """Given a comment and the full taxonomy/topic tree for the report, extract one or more claims from the comment.
    """
    client = OpenAI(api_key=api_key)

    # add taxonomy and comment to prompt template
    taxonomy_string = json.dumps(tree)

    # TODO: prompt nit, shorten this to just "Comment:"
    full_prompt = llm.user_prompt
    full_prompt += (
        "\n" + taxonomy_string + "\nAnd then here is the comment:\n" + comment
    )

    response = client.chat.completions.create(
        model=llm.model_name,
        messages=[
            {
                "role": "system",
                "content": llm.system_prompt,
            },
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    try:
        claims = response.choices[0].message.content
    except Exception:
        print("Step 2: no response: ", response)
        claims = {}
    # TODO: json.loads(claims) fails sometimes
    try:
        claims_obj = json.loads(claims)
    except JSONDecodeError:
        print("json_parse_failure;claims:", claims)
        claims_obj = claims
    return {"claims": claims_obj, "usage": response.usage}


####################################
# Step 2: Extract and place claims #
# ----------------------------------#
@app.post("/claims")
def comments_to_claims(
    req: CommentsLLMConfig,
    api_key: str = Depends(header_scheme),
    log_to_wandb: str = config.WANDB_GROUP_LOG_NAME,
    dry_run=False,
) -> dict:
    """Given the full list of comments, return a list of claims extracted from the comments.

    Input format:
    - CommentLLMConfig object: JSON/dictionary with the following fields:
      - comments: a list of Comment (each has a field, "text", for the raw text of the comment, and an id)
      - llm: a dictionary of the LLM configuration:
        - model_name: a string of the name of the LLM to call ("gpt-4o-mini", "gpt-4-turbo-preview")
        - system_prompt: a string of the system prompt
        - user_prompt: a string of the user prompt to convert the raw comments into claims
    Example:
    {
      "llm": {
          "model_name": "gpt-4o-mini",
          "system_prompt": "\n\tYou are a professional research assistant.",
          "user_prompt": "\nI will give you a list of comments."
      },
      "comments": [
          {
              "id": "c1",
              "text": "I love cats"
          },
          {
              "id": "c2",
              "text": "dogs are great"
          },
          {
              "id": "c3",
              "text": "I'm not sure about birds"
          }
      ]
    }

    Output format:
    - data : a list of claims, where each claim has
      - claim: a string of the claim text
      - comment_ids: a list of strings of the comment IDs that support this claim
    - usage: a dictionary of token counts
      - completion_tokens
      - prompt_tokens
      - total_tokens

    Example output:
    {
      "data": [
          {
              "claim": "Cats are loved as pets",
              "comment_ids": ["c1"]
          },
          {
              "claim": "Dogs are great pets",
              "comment_ids": ["c2"]
          },
          {
              "claim": "There is uncertainty about birds as pets",
              "comment_ids": ["c3"]
          }
      ],
      "usage": {
          "completion_tokens": 131,
          "prompt_tokens": 224,
          "total_tokens": 355
      }
    }
    """
    # skip calling an LLM
    if dry_run or config.DRY_RUN:
        print("dry_run claims")
        return config.MOCK_RESPONSE["claims"]

    if not api_key:
        raise HTTPException(status_code=401)
    client = OpenAI(api_key=api_key)

    # append comments to prompt
    full_prompt = req.llm.user_prompt
    for comment in req.comments:
        full_prompt += "\n" + comment.text

    response = client.chat.completions.create(
        model=req.llm.model_name,
        messages=[
            {"role": "system", "content": req.llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    try:
        claims = json.loads(response.choices[0].message.content)
    except Exception:
        print("Step 2: no claims: ", response)
        claims = []
    usage = response.usage
    # compute LLM costs for this step's tokens
    s2_total_cost = token_cost(
        req.llm.model_name, usage.prompt_tokens, usage.completion_tokens,
    )

    if log_to_wandb:
        try:
            exp_group_name = str(log_to_wandb)
            wandb.init(
                project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
            )
            wandb.config.update(
                {
                    "s2_claims/model": req.llm.model_name,
                    "s2_claims/user_prompt": req.llm.user_prompt,
                    "s2_claims/system_prompt": req.llm.system_prompt,
                },
            )
            comment_lengths = [len(c.text) for c in req.comments]
            num_claims = len(claims)

            # in case comments are empty / for W&B Table logging
            comment_list = "none"
            if len(req.comments) > 1:
                comment_list = "\n".join([c.text for c in req.comments])
            comms_claims_list = [[comment_list, json.dumps(claims, indent=1)]]
            wandb.log(
                {
                    "comm_N": len(req.comments),
                    "comm_text_len": sum(comment_lengths),
                    "comm_bins": comment_lengths,
                    "num_claims": num_claims,
                    "rows_to_claims": wandb.Table(
                        data=comms_claims_list, columns=["comments", "claims"],
                    ),
                    # token counts
                    "U_tok_N/claims": usage.total_tokens,
                    "U_tok_in/claims": usage.prompt_tokens,
                    "U_tok_out/claims": usage.completion_tokens,
                    "cost/s2_claims": s2_total_cost,
                },
            )
        except Exception:
            print("Failed to create wandb run")
    return {
        "data": claims,
        "usage": usage.model_dump(),
        "cost": s2_total_cost,
    }


def dedup_claims(claims: list, llm: LLMConfig, api_key: str) -> dict:
    """Given a list of claims for a given subtopic, identify which ones are near-duplicates
    """
    client = OpenAI(api_key=api_key)

    # add claims with enumerated ids (relative to this subtopic only)
    full_prompt = llm.user_prompt
    for i, orig_claim in enumerate(claims):
        full_prompt += "\nclaimId" + str(i) + ": " + orig_claim["claim"]

    response = client.chat.completions.create(
        model=config.MODEL,
        messages=[
            {"role": "system", "content": llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    try:
        deduped_claims = response.choices[0].message.content
    except Exception:
        print("Step 3: no deduped claims: ", response)
        deduped_claims = {}
    try:
        deduped_claims_obj = json.loads(deduped_claims)
    except JSONDecodeError:
        print("json failure;dedup:", deduped_claims)
        deduped_claims_obj = deduped_claims
    return {"dedup_claims": deduped_claims_obj, "usage": response.usage}


#####################################
# Step 3: Sort & deduplicate claims #
# -----------------------------------#
@app.post("/sort_claims_tree/")
def sort_claims_tree(
    req: ClaimTreeLLMConfig,
    api_key: str = Depends(header_scheme),
    log_to_wandb: str = config.WANDB_GROUP_LOG_NAME,
    dry_run=False,
) -> dict:
    """Given a tree of claims, sort them by importance and relevance.

    Input format:
    - ClaimsTree object: JSON/dictionary with the following fields:
      - claims: a list of claims, where each claim has
        - claim: a string of the claim text
        - comment_ids: a list of strings of the comment IDs that support this claim
      - llm: a dictionary of the LLM configuration:
        - model_name: a string of the name of the LLM to call ("gpt-4o-mini", "gpt-4-turbo-preview")
        - system_prompt: a string of the system prompt
        - user_prompt: a string of the user prompt to sort the claims
    Example:
    {
      "llm": {
          "model_name": "gpt-4o-mini",
          "system_prompt": "\n\tYou are a professional research assistant.",
          "user_prompt": "\nI will give you a list of claims."
      },
      "claims": [
          {
              "claim": "Cats are loved as pets",
              "comment_ids": ["c1"]
          },
          {
              "claim": "Dogs are great pets",
              "comment_ids": ["c2"]
          },
          {
              "claim": "There is uncertainty about birds as pets",
              "comment_ids": ["c3"]
          }
      ]
    }

    Output format:
    - data : a list of sorted claims, where each claim has
      - claim: a string of the claim text
      - comment_ids: a list of strings of the comment IDs that support this claim
      - importance: a number between 0 and 1 indicating the importance of the claim
      - relevance: a number between 0 and 1 indicating the relevance of the claim
    - usage: a dictionary of token counts
      - completion_tokens
      - prompt_tokens
      - total_tokens

    Example output:
    {
      "data": [
          {
              "claim": "Dogs are great pets",
              "comment_ids": ["c2"],
              "importance": 0.9,
              "relevance": 0.8
          },
          {
              "claim": "Cats are loved as pets",
              "comment_ids": ["c1"],
              "importance": 0.8,
              "relevance": 0.7
          },
          {
              "claim": "There is uncertainty about birds as pets",
              "comment_ids": ["c3"],
              "importance": 0.6,
              "relevance": 0.5
          }
      ],
      "usage": {
          "completion_tokens": 131,
          "prompt_tokens": 224,
          "total_tokens": 355
      }
    }
    """
    # skip calling an LLM
    if dry_run or config.DRY_RUN:
        print("dry_run sort claims tree")
        return config.MOCK_RESPONSE["sort_claims_tree"]

    if not api_key:
        raise HTTPException(status_code=401)
    client = OpenAI(api_key=api_key)

    # append claims to prompt
    full_prompt = req.llm.user_prompt
    for claim in req.claims:
        full_prompt += "\n" + claim["claim"]

    response = client.chat.completions.create(
        model=req.llm.model_name,
        messages=[
            {"role": "system", "content": req.llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    try:
        sorted_claims = json.loads(response.choices[0].message.content)
    except Exception:
        print("Step 3: no sorted claims: ", response)
        sorted_claims = []
    usage = response.usage
    # compute LLM costs for this step's tokens
    s3_total_cost = token_cost(
        req.llm.model_name, usage.prompt_tokens, usage.completion_tokens,
    )

    if log_to_wandb:
        try:
            exp_group_name = str(log_to_wandb)
            wandb.init(
                project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
            )
            wandb.config.update(
                {
                    "s3_sort/model": req.llm.model_name,
                    "s3_sort/user_prompt": req.llm.user_prompt,
                    "s3_sort/system_prompt": req.llm.system_prompt,
                },
            )
            num_claims = len(req.claims)
            num_sorted = len(sorted_claims)

            # in case claims are empty / for W&B Table logging
            claim_list = "none"
            if len(req.claims) > 1:
                claim_list = "\n".join([c["claim"] for c in req.claims])
            claims_sorted_list = [[claim_list, json.dumps(sorted_claims, indent=1)]]
            wandb.log(
                {
                    "claim_N": num_claims,
                    "num_sorted": num_sorted,
                    "rows_to_sorted": wandb.Table(
                        data=claims_sorted_list, columns=["claims", "sorted_claims"],
                    ),
                    # token counts
                    "U_tok_N/sort": usage.total_tokens,
                    "U_tok_in/sort": usage.prompt_tokens,
                    "U_tok_out/sort": usage.completion_tokens,
                    "cost/s3_sort": s3_total_cost,
                },
            )
        except Exception:
            print("Failed to create wandb run")
    return {
        "data": sorted_claims,
        "usage": usage.model_dump(),
        "cost": s3_total_cost,
    }


###########################################
# Optional / New Feature & Research Steps #
# -----------------------------------------#
# Steps below are optional/exploratory components of the T3C LLM pipeline.


########################################
# Crux claims and controversy analysis #
# --------------------------------------#
# Our first research feature finds "crux claims" to distill the perspectives
# on each subtopic into the core controversy — summary statements on which speakers
# are most evenly split into "agree" or "disagree" sides.
# We prompt an LLM for a crux claim with an explanation, given all the speakers' claims
# on each subtopic (along with the parent topic and a short description). We anonymize
# the claims before sending them to the LLM to protect PII and minimize any potential bias
# based on known speaker identity (e.g. when processing claims made by popular writers)
def controversy_matrix(cont_mat: list) -> list:
    """Compute a controversy matrix from individual speaker opinions on crux claims,
    as predicted by an LLM. For each pair of cruxes, for each speaker:
    # - add 0 only if the speaker agrees with both cruxes
    # - add 0.5 if the speaker has an opinion on one crux, but no known opinion on the other
    # - add 1 if the speaker has a known different opinion on each crux (agree/disagree or disagree/agree)
    # Sum the totals for each pair of cruxes in the corresponding cell in the cross-product
    # and return the matrix of scores.
    """
    cm = [[0 for a in range(len(cont_mat))] for b in range(len(cont_mat))]

    # loop through all the crux statements,
    for claim_index, row in enumerate(cont_mat):
        # these are the scores for each speaker
        per_speaker_scores = row[1:]
        for score_index, score in enumerate(per_speaker_scores):
            # we want this speaker's scores for all statements except current one
            other_scores = [
                item[score_index + 1] for item in cont_mat[claim_index + 1 :]
            ]
            for other_index, other_score in enumerate(other_scores):
                # if the scores match, there is no controversy — do not add anything
                if score != other_score:
                    # we only know one of the opinions
                    if score == 0 or other_score == 0:
                        cm[claim_index][claim_index + other_index + 1] += 0.5
                        cm[claim_index + other_index + 1][claim_index] += 0.5
                    # these opinions are different — max controversy
                    else:
                        cm[claim_index][claim_index + other_index + 1] += 1
                        cm[claim_index + other_index + 1][claim_index] += 1
    return cm


def cruxes_for_topic(
    llm: dict, topic: str, topic_desc: str, claims: list, speaker_map: dict, api_key: str,
) -> dict:
    """For each fully-described subtopic, provide all the relevant claims with an anonymized
    numeric speaker id, and ask the LLM for a crux claim that best splits the speakers' opinions
    on this topic (ideally into two groups of equal size for agreement vs disagreement with the crux claim)
    """
    client = OpenAI(api_key=api_key)
    claims_anon = []
    speaker_set = set()
    for claim in claims:
        if "speaker" in claim:
            speaker_anon = speaker_map[claim["speaker"]]
            speaker_set.add(speaker_anon)
            speaker_claim = speaker_anon + ":" + claim["claim"]
            claims_anon.append(speaker_claim)

    # TODO: if speaker set is too small / all one person, do not generate cruxes
    if len(speaker_set) < 2:
        print("fewer than 2 speakers: ", topic)
        return None

    full_prompt = llm.user_prompt
    full_prompt += "\nTopic: " + topic + ": " + topic_desc
    full_prompt += "\nParticipant claims: \n" + json.dumps(claims_anon)

    response = client.chat.completions.create(
        model=llm.model_name,
        messages=[
            {"role": "system", "content": llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    crux = response.choices[0].message.content
    try:
        crux_obj = json.loads(crux)
    except JSONDecodeError:
        crux_obj = crux
    return {"crux": crux_obj, "usage": response.usage}


def top_k_cruxes(cont_mat: list, cruxes: list, top_k: int = 0) -> list:
    """Return the top K most controversial crux pairs.
    Optionally let the caller set K, otherwise default
    to the ceiling of the square root of the number of crux claims.
    """
    if top_k == 0:
        K = min(math.ceil(math.sqrt(len(cruxes))), 10)
    else:
        K = top_k
    # let's sort a triangular half of the symmetrical matrix (diagonal is all zeros)
    scores = []
    for x in range(len(cont_mat)):
        for y in range(x + 1, len(cont_mat)):
            scores.append([cont_mat[x][y], x, y])
    all_scored_cruxes = sorted(scores, key=lambda x: x[0], reverse=True)
    top_cruxes = [
        {"score": score, "cruxA": cruxes[x], "cruxB": cruxes[y]}
        for score, x, y in all_scored_cruxes[:K]
    ]
    return top_cruxes


@app.post("/cruxes/")
def cruxes(
    req: CruxesLLMConfig,
    api_key: str = Depends(header_scheme),
    log_to_wandb: str = config.WANDB_GROUP_LOG_NAME,
    dry_run=False,
) -> dict:
    """Given a list of claims, extract the key cruxes (core issues or points of contention).

    Input format:
    - CruxesLLMConfig object: JSON/dictionary with the following fields:
      - claims: a list of claims, where each claim has
        - claim: a string of the claim text
        - comment_ids: a list of strings of the comment IDs that support this claim
      - llm: a dictionary of the LLM configuration:
        - model_name: a string of the name of the LLM to call ("gpt-4o-mini", "gpt-4-turbo-preview")
        - system_prompt: a string of the system prompt
        - user_prompt: a string of the user prompt to extract cruxes
    Example:
    {
      "llm": {
          "model_name": "gpt-4o-mini",
          "system_prompt": "\n\tYou are a professional research assistant.",
          "user_prompt": "\nI will give you a list of claims."
      },
      "claims": [
          {
              "claim": "Cats are loved as pets",
              "comment_ids": ["c1"]
          },
          {
              "claim": "Dogs are great pets",
              "comment_ids": ["c2"]
          },
          {
              "claim": "There is uncertainty about birds as pets",
              "comment_ids": ["c3"]
          }
      ]
    }

    Output format:
    - data : a list of cruxes, where each crux has
      - crux: a string of the crux text
      - claim_ids: a list of strings of the claim IDs that support this crux
      - importance: a number between 0 and 1 indicating the importance of the crux
    - usage: a dictionary of token counts
      - completion_tokens
      - prompt_tokens
      - total_tokens

    Example output:
    {
      "data": [
          {
              "crux": "The role of pets in modern society",
              "claim_ids": ["c1", "c2", "c3"],
              "importance": 0.9
          },
          {
              "crux": "The suitability of different types of pets",
              "claim_ids": ["c1", "c2", "c3"],
              "importance": 0.8
          }
      ],
      "usage": {
          "completion_tokens": 131,
          "prompt_tokens": 224,
          "total_tokens": 355
      }
    }
    """
    # skip calling an LLM
    if dry_run or config.DRY_RUN:
        print("dry_run cruxes")
        return config.MOCK_RESPONSE["cruxes"]

    if not api_key:
        raise HTTPException(status_code=401)
    client = OpenAI(api_key=api_key)

    # append claims to prompt
    full_prompt = req.llm.user_prompt
    for claim in req.claims:
        full_prompt += "\n" + claim["claim"]

    response = client.chat.completions.create(
        model=req.llm.model_name,
        messages=[
            {"role": "system", "content": req.llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    try:
        cruxes = json.loads(response.choices[0].message.content)
    except Exception:
        print("Step 4: no cruxes: ", response)
        cruxes = []
    usage = response.usage
    # compute LLM costs for this step's tokens
    s4_total_cost = token_cost(
        req.llm.model_name, usage.prompt_tokens, usage.completion_tokens,
    )

    if log_to_wandb:
        try:
            exp_group_name = str(log_to_wandb)
            wandb.init(
                project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
            )
            wandb.config.update(
                {
                    "s4_cruxes/model": req.llm.model_name,
                    "s4_cruxes/user_prompt": req.llm.user_prompt,
                    "s4_cruxes/system_prompt": req.llm.system_prompt,
                },
            )
            num_claims = len(req.claims)
            num_cruxes = len(cruxes)

            # in case claims are empty / for W&B Table logging
            claim_list = "none"
            if len(req.claims) > 1:
                claim_list = "\n".join([c["claim"] for c in req.claims])
            claims_cruxes_list = [[claim_list, json.dumps(cruxes, indent=1)]]
            wandb.log(
                {
                    "claim_N": num_claims,
                    "num_cruxes": num_cruxes,
                    "rows_to_cruxes": wandb.Table(
                        data=claims_cruxes_list, columns=["claims", "cruxes"],
                    ),
                    # token counts
                    "U_tok_N/cruxes": usage.total_tokens,
                    "U_tok_in/cruxes": usage.prompt_tokens,
                    "U_tok_out/cruxes": usage.completion_tokens,
                    "cost/s4_cruxes": s4_total_cost,
                },
            )
        except Exception:
            print("Failed to create wandb run")
    return {
        "data": cruxes,
        "usage": usage.model_dump(),
        "cost": s4_total_cost,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
