#!/usr/bin/env python

########################################
# T3C Pyserver: LLM Pipeline in Python #
#--------------------------------------#
"""
A minimal FastAPI Python server calling the T3C LLM pipeline.

Each pipeline call assumes the client has already included
any user edits of the LLM configuration, including the model
name to use, the system prompt, and the specific pipeline step prompts.

Currently only supports OpenAI (Anthropic soon!!!)
For local testing, load these from a config.py file
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
import json
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Union
import wandb

import pyserver.config as config
from pyserver.utils import cute_print

class Comment(BaseModel):
  id: str
  text: str

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

class ClaimTree(BaseModel):
  tree: dict 

app = FastAPI()

@app.get("/")
def read_root():
  # TODO: setup/relevant defaults?
  return {"Hello": "World"}

###################################
# Step 1: Comments to Topic Tree  #
#---------------------------------#
@app.post("/topic_tree/")
def comments_to_tree(req: CommentsLLMConfig, log_to_wandb:bool = False):
  """
  Given the full list of comments, return a corresponding taxonomy of relevant topics and their
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
            "id: "..",
            "text": "I love cats"
        },
        {
            "id: "..",
            "text": "dogs are great"
        },
        {
            "id: "..",
            "text": "I'm not sure about birds"
        }
    ]
  }
  
  Output format:
  - tree : a dictionary
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
    "tree": {
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
  client = OpenAI()

  # append comments to prompt
  full_prompt = req.llm.user_prompt
  for comment in req.comments:
    full_prompt += "\n" + comment.text

  response = client.chat.completions.create(
    model=req.llm.model_name,
    messages=[
      {
        "role": "system",
        "content": req.llm.system_prompt
      },
      {
        "role": "user",
        "content": full_prompt
      }
    ],
    temperature = 0.0,
    response_format = {"type": "json_object"}
  )
  try:
    tree = json.loads(response.choices[0].message.content)
  except:
    print("Step 1: no topic tree: ", response)
    tree = {}
  usage = response.usage
    
  if log_to_wandb:
    # TODO: one pipeline run should be one run — perhaps a group?
    wandb.init(project = config.WANDB_PROJECT_NAME,
               config={"model" : req.llm.model_name})

    comment_lengths = [len(c.text) for c in req.comments]
    num_topics = len(tree["taxonomy"])
    subtopic_bins = [len(t["subtopics"]) for t in tree["taxonomy"]]

    # in case comments are empty / for W&B Table logging
    comment_list = "none"
    if len(comments.comments) > 1:
      comment_list = "\n".join([c.text for c in req.comments])
    comms_tree_list = [[comment_list, json.dumps(tree,indent=1)]]

    wandb.log({
        "comm_N" : len(comments.comments),
        "comm_text_len": sum(comment_lengths),
        "comm_bins" : comment_lengths,
        "num_topics" : num_topics,
        "num_subtopics" : sum(subtopic_bins),
        "subtopic_bins" : subtopic_bins,
        "rows_to_tree" : wandb.Table(data=comms_tree_list,
                                     columns = ["comments", "taxonomy"]),

        # token counts
        "u/1/N_tok": usage.total_tokens,
        "u/1/in_tok" : usage.prompt_tokens,
        "u/1/out_tok": usage.completion_tokens
    })

  return {"tree" : tree, "usage" : usage}

def comment_to_claims(llm:dict, comment:str, tree:dict)-> dict:
  """
  Given a comment and the full taxonomy/topic tree for the report, extract one or more claims from the comment.
  """
  client = OpenAI()

  # add taxonomy and comment to prompt template
  taxonomy_string = json.dumps(tree)
   
  # TODO: prompt nit, shorten this to just "Comment:"
  full_prompt = llm.user_prompt
  full_prompt += "\n" + taxonomy_string + "\nAnd then here is the comment:\n" + comment

  response = client.chat.completions.create(
    model = llm.model_name,
    messages = [
      {
        "role": "system",
        "content": llm.system_prompt,
      },
      {
        "role": "user",
        "content": full_prompt
      }
    ],
    temperature = 0.0,
    response_format = {"type": "json_object"}
  )
  try:
    claims = response.choices[0].message.content
  except:
    print("Step 2: no response: ", response)
    claims = {}
  return {"claims" : json.loads(claims), "usage" : response.usage}

####################################
# Step 2: Extract and place claims #
#----------------------------------#
@app.post("/claims/")
def all_comments_to_claims(req:CommentTopicTree, log_to_wandb:bool = False) -> dict:
  """
  Given a comment and the taxonomy/topic tree for the report, extract one or more claims from the comment.
  Place each claim under the correct subtopic in the tree.
  
  Input format:
  - CommentTopicTree object: JSON/dictionary with the following fields:
    - comments: a list of Comment (each has a field, "text", for the raw text of the comment, and an id)
    - llm: a dictionary of the LLM configuration:
      - model_name: a string of the name of the LLM to call ("gpt-4o-mini", "gpt-4-turbo-preview")
      - system_prompt: a string of the system prompt
      - user_prompt: a string of the user prompt to convert the raw comments into the
                           taxonomy/topic tree
   - tree: a dictionary of the topics and nested subtopics, and their titles/descriptions
  Example:
  {
    "llm": {
        "model_name": "gpt-4o-mini",
        "system_prompt": "\n\tYou are a professional research assistant.",
        "user_prompt": "\nI'm going to give you a comment made by a participant",
    },
    "comments": [
        {
            "id": "..",
            "text": "I love cats"
        },
        {
            "id": "..",
            "text": "dogs are great"
        },
        {
            "id": "..",
            "text": "I'm not sure about birds"
        }
    ],
    "tree": {
        "taxonomy": [
            {
                "topicName": "Pets",
                "topicShortDescription": "General opinions about common household pets.",
                "subtopics": [
                    {
                        "subtopicName": "Cats",
                        "subtopicShortDescription": "Positive sentiments towards cats."
                    },
                    {
                        "subtopicName": "Dogs",
                        "subtopicShortDescription": "Positive sentiments towards dogs."
                    },
                    {
                        "subtopicName": "Birds",
                        "subtopicShortDescription": "Uncertainty or mixed feelings about birds."
                    }
                ]
            }
        ]
    }
  }

  Output format:
  - claims_tree: the dictionary of topics and subtopics with extracted claims listed under the
                 correct subtopic, along with the source quote
  - usage: a dictionary of token counts for the LLM calls of this pipeline step
    - completion_tokens
    - prompt_tokens
    - total_tokens
  
  Example output:
  {
    "claims_tree": {
        "Pets": {
            "total": 3,
            "subtopics": {
                "Cats": {
                    "total": 1,
                    "claims": [
                        {
                            "claim": "Cats are the best household pets.",
                            commentId":"..",
                            "quote": "I love cats",
                            "topicName": "Pets",
                            "subtopicName": "Cats"
                        }
                    ]
                },
                "Dogs": {
                    "total": 1,
                    "claims": [
                        {
                            "claim": "Dogs are superior pets.",
                            "commentId":"..",
                            "quote": "dogs are great",
                            "topicName": "Pets",
                            "subtopicName": "Dogs"
                        }
                    ]
                },
                "Birds": {
                    "total": 1,
                    "claims": [
                        {
                            "claim": "Birds are not suitable pets for everyone.",
                            "commentId":"..",
                            "quote": "I'm not sure about birds.",
                            "topicName": "Pets",
                            "subtopicName": "Birds"
                        }
                    ]
                }
            }
        }
    }
  }
  """
  comms_to_claims = []
  comms_to_claims_html = []
  TK_2_IN = 0
  TK_2_OUT = 0
  TK_2_TOT = 0

  node_counts = {}

  # TODO: batch this so we're not sending the tree each time
  for comment in req.comments: 
    response = comment_to_claims(req.llm, comment.text, req.tree)
    try:
      claims = response["claims"]
      # Add commentId to claim to track origin
      [claim.update({'commentId':comment.id}) for claim in claims['claims']]
    except:
      print("Step 2: no claims for comment: ", response)
      claims = None
    # reference format
    #{'claims': [{'claim': 'Dogs are superior pets.', commentId:'..', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs'}]} 
    usage = response["usage"]
    if claims and len(claims["claims"]) > 0:
      comms_to_claims.extend([c for c in claims["claims"]])

    TK_2_IN += usage.prompt_tokens
    TK_2_OUT += usage.completion_tokens
    TK_2_TOT += usage.total_tokens

    # format for logging to W&B
    if log_to_wandb:
      viz_claims = cute_print(claims)
      comms_to_claims_html.append([comment.text, viz_claims])  

  # reference format
  #[{'claim': 'Cats are the best household pets.', commentId:'..', 'quote': 'I love cats', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {commentId:'..','claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs'}, {commentId:'..', 'claim': 'Birds are not suitable pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds'}]
 
  # count the claims in each subtopic 
  for claim in comms_to_claims:
    if "topicName" in claim:
      if claim["topicName"] in node_counts:
        node_counts[claim["topicName"]]["total"] += 1
        if "subtopicName" in claim:
          if claim["subtopicName"] in node_counts[claim["topicName"]]["subtopics"]:
            node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]]["total"] += 1
            node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]]["claims"].append(claim)
          else:
            node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]] = { "total" : 1, "claims" : [claim]}
      else:
        node_counts[claim["topicName"]] = {"total" : 1, "subtopics" : {claim["subtopicName"] : {"total" : 1, "claims" : [claim]}}}


  if log_to_wandb:
    wandb.init(project = config.WANDB_PROJECT_NAME,
               config={"model" : req.llm.model_name})
    wandb.log({
      "u/2/N_tok" : TK_2_TOT,
      "u/2/in_tok": TK_2_IN,
      "u/2/out_tok" : TK_2_OUT,
      "rows_to_claims" : wandb.Table(
                           data=comms_to_claims_html,
                           columns = ["comments", "claims"])
    })
 
  net_usage = {"total_tokens" : TK_2_TOT,
               "prompt_tokens" : TK_2_IN,
               "completion_tokens" : TK_2_OUT}


  return {"claims_tree" : node_counts, "usage" : net_usage}

def dedup_claims(claims:list)-> dict:
  """
  Given a list of claims for a given subtopic, identify which ones are near-duplicates
  """
  client = OpenAI()

  # add claims with enumerated ids (relative to this subtopic only)
  full_prompt = config.CLAIM_DEDUP_PROMPT
  for i, orig_claim in enumerate(claims):
    full_prompt += "\nclaimId"+str(i)+ ": " + orig_claim["claim"]

  response = client.chat.completions.create(
    model = config.MODEL,
    messages = [
      {
        "role": "system",
        "content": config.SYSTEM_PROMPT
      },
      {
            "role": "user",
            "content": full_prompt
      }
    ],
    temperature = 0.0,
    response_format = {"type": "json_object"}
  )
  try:
    deduped_claims = response.choices[0].message.content
  except:
    print("Step 3: no deduped claims: ", response)
    deduped_claims = {}
  return {"dedup_claims" : json.loads(deduped_claims), "usage" : response.usage}

#####################################
# Step 3: Sort & deduplicate claims #
#-----------------------------------#
@app.put("/sort_claims_tree/")
def sort_claims_tree(claims_tree:ClaimTree, log_to_wandb: bool = False)-> dict:
  """
  Sort the topic/subtopic tree so that the most popular claims, subtopics, and topics
  all appear first. Deduplicate claims within each subtopic so that any near-duplicates appear as
  nested/child objects of a first-in parent claim, under the key "duplicates"
  
  Input format:
  - ClaimTree object: JSON/dictionary with the following fields
    - tree: the topic tree / full taxonomy of topics, subtopics, and claims (each with their full schema,
            including the claim, quote, topic, and subtopic)
  Example input tree:
  {
   "tree" : {
    "Pets": {
        "total": 5,
        "subtopics": {
            "Cats": {
                "total": 2,
                "claims": [
                    {
                        "claim": "Cats are the best pets.",
                        "commentId":"..",
                        "quote": "I love cats.",
                        "topicName": "Pets",
                        "subtopicName": "Cats"
                    },
                    {
                        "claim": "Cats are the best pets.",
                        "commentId":"..",
                        "quote": "I really really love cats",
                        "topicName": "Pets",
                        "subtopicName": "Cats"
                    }
                ]
            },
            "Dogs": {
                "total": 1,
                "claims": [
                    {
                        "claim": "Dogs are superior pets.",
                        "commentId":"..",
                        "quote": "dogs are great",
                        "topicName": "Pets",
                        "subtopicName": "Dogs"
                    }
                ]
            },
            "Birds": {
                "total": 2,
                "claims": [
                    {
                        "claim": "Birds are not ideal pets for everyone.",
                        "commentId":"..",
                        "quote": "I'm not sure about birds.",
                        "topicName": "Pets",
                        "subtopicName": "Birds"
                    },
                    {
                        "claim": "Birds are not suitable pets for everyone.",
                        "commentId":"..",
                        "quote": "I don't know about birds.",
                        "topicName": "Pets",
                        "subtopicName": "Birds"
                    }
                ]
            }
        }
    }
   }
  } 
  Output format:
  - response object: JSON/dictionary wiht the following fields
    - tree: the deduplicated claims & correctly sorted topic tree / full taxonomy of topics, subtopics, 
            and claims, where the most popular topics/subtopics/claims (by near-duplicate count) appear
            first within each level of nesting
    - usage: token counts for the LLM calls of the deduplication step of the pipeline
      - completion_tokens
      - prompt_tokens
      - total_tokens

  Example output tree:
  [
    [
        "Pets",
        {
            "total": 5,
            "topics": [
                [
                    "Cats",
                    {
                        "total": 2,
                        "claims": [
                            {
                                "claim": "Cats are the best pets.",
                                "commentId:"..",
                                "quote": "I love cats.",
                                "topicName": "Pets",
                                "subtopicName": "Cats",
                                "duplicates": [
                                    {
                                        "claim": "Cats are the best pets.",
                                        "commendId:".."
                                        "quote": "I really really love cats",
                                        "topicName": "Pets",
                                        "subtopicName": "Cats",
                                        "duplicated": true
                                    }
                                ]
                            }
                        ]
                    }
                ],
                [
                    "Birds",
                    {
                        "total": 2,
                        "claims": [
                            {
                                "claim": "Birds are not ideal pets for everyone.",
                                "commentId:"..",
                                "quote": "I'm not sure about birds.",
                                "topicName": "Pets",
                                "subtopicName": "Birds",
                                "duplicates": [
                                    {
                                        "claim": "Birds are not suitable pets for everyone.",
                                        "commentId" "..",
                                        "quote": "I don't know about birds.",
                                        "topicName": "Pets",
                                        "subtopicName": "Birds",
                                        "duplicated": true
                                    }
                                ]
                            }
                        ]
                    }
                ],
                [
                    "Dogs",
                    {
                        "total": 1,
                        "claims": [
                            {
                                "claim": "Dogs are superior pets.",
                                "commentId" "..",
                                "commentId:"..",
                                "quote": "dogs are great",
                                "topicName": "Pets",
                                "subtopicName": "Dogs"
                            }
                        ]
                    }
                ]
            ]
        }
    ]
  ]

  For each subtopic, send the contained claims to an LLM to detect near-duplicates.
  These will be returned as dictionaries, where the keys are all the claims for the subtopic,
  numbered with relative ids (claimId0, claimId1, claimId2...claimIdN-1 for N claims), and the
  value for each claim id is a list of the relative claim ids of any near-duplicates.
  Note that this mapping is not guaranteed to be symmetric: claimId0 may have an empty list,
  but claimId1 may have claimId0 and claimId2 in the list. Hence we build a dictionary of
  all the relative ids encountered, and return near duplicates accounting for this asymmetry.  

  After deduplication, the full tree of topics, subtopics, and their claims is sorted:
  - more frequent topics appear first
  - within each topic, more frequent subtopics appear first
  - within each subtopic, claims with the most duplicates (ie most supporting quotes) appear first
  Note that currently these duplicates are not counted towards the total claims in a subtopic/topic
  for sorting at the higher levels.

  For now, "near-duplicates" have similar meanings—this is not exact/identical claims and
  we may want to refine this in the future.

  We may also want to allow for other sorting/filtering styles, where the number of duplicates
  DOES matter, or where we want to sum the claims by a particular speaker or by other metadata 
  towards the total for a subtopic/topic.
  """

  TK_IN = 0
  TK_OUT = 0
  TK_TOT = 0

  sorted_tree = {} 
  for topic, topic_data in claims_tree.tree.items():
    per_topic_total = 0
    per_topic_list = {}
    for subtopic, subtopic_data in topic_data["subtopics"].items():
      per_topic_total += subtopic_data["total"]
      # canonical order of claims: as they appear in subtopic_data["claims"]
      # no need to deduplicate single claims
      if subtopic_data["total"] > 1:
        try:
          response = dedup_claims(subtopic_data["claims"])
        except:
          print("Step 3: no deduped claims response for: ", subtopic_data["claims"])
          continue
        deduped = response["dedup_claims"]
        usage = response["usage"]

        # check for duplicates bidirectionally, as we may get either of these scenarios
        # for the same pair of claims:
        # {'nesting': {'claimId0': [], 'claimId1': ['claimId0']}} => {0: [1], 1: [0]}
	# {'nesting': {'claimId0': ['claimId1'], 'claimId1': []}} => {0: [1], 1: [0]}
        # anecdata: recent models may be better about this?

        claim_set = {}
        if "nesting" in deduped:
          # implementation notes:
          # - MOST claims should NOT be near-duplicates
          # - nesting where |claim_vals| > 0 should be a smaller set than |subtopic_data["claims"]|
          # - but also we won't have duplicate info bidirectionally — A may be dupe of B, but B not dupe of A
          for claim_key, claim_vals in deduped["nesting"].items():
            # this claim_key has some duplicates
            if len(claim_vals) > 0:
              # extract relative index
              claim_id = int(claim_key.split("Id")[1])
              dupe_ids = [int(dupe_claim_key.split("Id")[1]) for dupe_claim_key in claim_vals]
              # assume duplication is symmetric: add claim_id to dupe_ids, check that each of these maps to the others
              all_dupes = [claim_id]
              all_dupes.extend(dupe_ids)
              for curr_id, dupe in enumerate(all_dupes):
                other_ids = [d for i, d in enumerate(all_dupes) if i != curr_id]
                if dupe in claim_set:  
                  for other_id in other_ids: 
                    if other_id not in claim_set[dupe]:
                      claim_set[dupe].append(other_id)
                else:
                  claim_set[dupe] = other_ids

        accounted_for_ids = {}
        deduped_claims = []
        # for each claim in our original list
        for claim_id in range(len(subtopic_data["claims"])):
          # only create a new claim if we haven't visited this one already
          if claim_id not in accounted_for_ids:
            clean_claim = {k : v for k, v in subtopic_data["claims"][claim_id].items()}
            clean_claim["duplicates"] = []
          
            # if this claim has some duplicates
            if claim_id in claim_set:
              dupe_ids = claim_set[claim_id]
              for dupe_id in dupe_ids:
                if dupe_id not in accounted_for_ids:
                  dupe_claim = {k : v for k, v in subtopic_data["claims"][dupe_id].items()}
                  dupe_claim["duplicated"] = True
               
                 # add all duplicates as children of main claim
                  clean_claim["duplicates"].append(dupe_claim)
                  accounted_for_ids[dupe_id] = 1
            
            # add verified claim (may be identical if it has no dupes, except for duplicates: [] field)
            deduped_claims.append(clean_claim)
            accounted_for_ids[claim_id] = 1
         
        # sort so the most duplicated claims are first
        sorted_deduped_claims = sorted(deduped_claims, key=lambda x: len(x["duplicates"]), reverse=True)
        if log_to_wandb:
          dupe_logs.append(["\n".join(subtopic_data["claims"]), json.dumps(sorted_deduped_claims, indent=1)])
        
        TK_TOT += usage.total_tokens
        TK_IN += usage.prompt_tokens
        TK_OUT += usage.completion_tokens
      else:
        # just one claim! already sorted!
        sorted_deduped_claims = subtopic_data["claims"]
        
      # add list of sorted, deduplicated claims to the right subtopic node in the tree
      per_topic_list[subtopic] = {"total" : subtopic_data["total"], "claims" : sorted_deduped_claims}

    # sort all the subtopics in a given topic
    sorted_subtopics = sorted(per_topic_list.items(), key=lambda x: x[1]["total"], reverse=True)
    sorted_tree[topic] = {"total" : per_topic_total, "topics" : sorted_subtopics}

  # sort all the topics in the tree
  full_sort_tree = sorted(sorted_tree.items(), key=lambda x: x[1]["total"], reverse=True)
 
  if log_to_wandb:
    wandb.init(project = config.WANDB_PROJECT_NAME,
               config = {"model" : config.MODEL})
    report_data = [[json.dumps(full_sort_tree, indent=2)]]
    wandb.log({
      "u/4/N_tok" : TK_TOT,
      "u/4/in_tok": TK_IN,
      "u/4/out_tok" : TK_OUT,
      "deduped_claims" : wandb.Table(data=dupe_logs, columns = ["full_flat_claims", "deduped_claims"]),
      "t3c_report" : wandb.Table(data=report_data, columns = ["t3c_report"])
    })
  net_usage = {"total_tokens" : TK_TOT,
               "prompt_tokens" : TK_IN,
               "completion_tokens" : TK_OUT}

  return {"tree" : full_sort_tree, "usage" : net_usage} 
# TODO: RETURN USAGE DUH

#TODO: refactor into separate testing script

######################
# Testing the server #
#--------------------#
tiny_pet_comments = [{"text" : "I love cats"}, {"text" : "dogs are great"}, {"text" : "I'm not sure about birds"}, {"text" : "I really really love cats"}, {"text" : "I don't know about birds"}]

sample_tree_4o = {"taxonomy" : [{'topicName': 'Pets', 'topicShortDescription': 'General opinions about common household pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Positive sentiments towards cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Positive sentiments towards dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Uncertainty or mixed feelings about birds.'}]}]}

dupe_claims_4o = {'Pets': {'total': 5, 'subtopics': {'Cats': {'total': 2, 'claims': ['Cats are the best household pets.', 'Cats are superior pets compared to other animals.']}, 'Dogs': {'total': 2, 'claims': ['Dogs are superior pets compared to other animals.', 'Dogs are superior pets.']}, 'Birds': {'total': 1, 'claims': ['Birds are not suitable pets for everyone.']}}}}

pet_comments = [{"text" : "I love cats"}, {"text" : "I really really love dogs"},{"text" : "I'm not sure about birds"}, {"text" : "Cats are my favorite"}, {"text" : "Lizards are terrifying"}, \
  {"text" : "Lizards are so friggin scary"}, {"text" : "Dogs are the best"}, {"text":  "No seriously dogs are great"}, {"text" : "Birds I'm hesitant about"}, {"text" : "I'm wild about cats"}, \
  {"text" : "Dogs and cats are both adorable and fluffy"}, {"text" : "Good pets are chill"}, {"text" :"Cats are fantastic"}, {"text" : "Lizards are scary"}, {"text" : "Kittens are so boring"}]

pet_tree_4o = {"tree": {'taxonomy': [{'topicName': 'Pets', 'topicShortDescription': 'General discussion about various types of pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Comments expressing love and opinions about cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Comments expressing love and opinions about dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Comments expressing uncertainty or hesitation about birds.'}, {'subtopicName': 'Lizards', 'subtopicShortDescription': 'Comments expressing fear or dislike of lizards.'}]}]}}

pets_claims_4o = {'Pets': {'total': 17, 'subtopics': {'Cats': {'total': 6, 'claims': [{'claim': 'Cats are the best pets.', 'quote': 'I love cats.', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Cats are superior pets.', 'quote': 'Cats are my favorite.', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Cats are the best pets.', 'quote': "I'm wild about cats", 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Cats are adorable.', 'quote': 'Cats [...] are adorable', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Cats are superior pets.', 'quote': 'Cats are fantastic.', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Kittens are not engaging pets.', 'quote': 'Kittens are so boring', 'topicName': 'Pets', 'subtopicName': 'Cats'}]}, 'Dogs': {'total': 4, 'claims': [{'claim': 'Dogs are the best pets.', 'quote': 'I really really love dogs.', 'topicName': 'Pets', 'subtopicName': 'Dogs'}, {'claim': 'Dogs are superior to other pets.', 'quote': 'Dogs are the best.', 'topicName': 'Pets', 'subtopicName': 'Dogs'}, {'claim': 'Dogs are superior pets.', 'quote': 'No seriously dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs'}, {'claim': 'Dogs are adorable.', 'quote': 'Dogs [...] are adorable', 'topicName': 'Pets', 'subtopicName': 'Dogs'}]}, 'Birds': {'total': 3, 'claims': [{'claim': 'Birds are not suitable pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds'}, {'claim': 'Birds can be unpredictable pets.', 'quote': "I'm hesitant about birds [...].", 'topicName': 'Pets', 'subtopicName': 'Birds'}, {'claim': 'Birds require specific care that may not suit everyone.', 'quote': "I'm hesitant about birds [...].", 'topicName': 'Pets', 'subtopicName': 'Birds'}]}, 'Lizards': {'total': 3, 'claims': [{'claim': 'Lizards should be avoided as pets.', 'quote': 'Lizards are terrifying.', 'topicName': 'Pets', 'subtopicName': 'Lizards'}, {'claim': 'Lizards should be avoided due to their frightening nature.', 'quote': 'Lizards are so friggin scary', 'topicName': 'Pets', 'subtopicName': 'Lizards'}, {'claim': 'Lizards should be avoided as pets.', 'quote': 'Lizards are scary.', 'topicName': 'Pets', 'subtopicName': 'Lizards'}]}, 'General discussion about various types of pets.': {'total': 1, 'claims': [{'claim': 'Good pets should have a calm demeanor.', 'quote': 'Good pets are chill.', 'topicName': 'Pets', 'subtopicName': 'General discussion about various types of pets.'}]}}}}


local_test_llm = { 
  "model_name" : "gpt-4o-mini",
  "system_prompt": """
	You are a professional research assistant. You have helped run many public consultations,
	surveys and citizen assemblies. You have good instincts when it comes to extracting interesting insights.
	You are familiar with public consultation tools like Pol.is and you understand the benefits
	for working with very clear, concise claims that other people would be able to vote on.
	""",
  "user_tree_prompt": """
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
}

local_test_llm_claims = { 
  "model_name" : "gpt-4o-mini",
  "system_prompt": """
	You are a professional research assistant. You have helped run many public consultations,
	surveys and citizen assemblies. You have good instincts when it comes to extracting interesting insights.
	You are familiar with public consultation tools like Pol.is and you understand the benefits
	for working with very clear, concise claims that other people would be able to vote on.
	""",
  "user_prompt": """
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
}

def test_topic_tree():
  #response = client.post("/topic_tree/?log_to_wandb=True", json={"comments" : [{"text" : "I love cats"},{"text" : "dogs are great"},{"text":"I'm not sure about birds"}]})
  req ={"llm" : local_test_llm, "comments" : [{"text" : "I love cats"},{"text" : "dogs are great"},{"text":"I'm not sure about birds"}]}
  print(req)
  response = client.post("/topic_tree/", json=req)
  print(response.json())

def test_claims():
  req = {"llm" : local_test_llm_claims, "comments" : [{"text" : "I love cats"},{"text" : "dogs are great"},{"text":"I'm not sure about birds"}], "tree" : sample_tree_4o}
  print(req)
  response = client.post("/claims/", json=req)
  print(response.json())

def test_dupes():
  #response = client.put("/sort_claims_tree/?log_to_wandb=True", json={"tree" : dupe_claims_4o})
  response = client.put("/sort_claims_tree/", json={"tree" : dupe_claims_4o})
  print(response.json())

def test_full(comments:list, tree:dict=pet_tree_4o):
  response = client.post("/topic_tree/", json={"comments" : comments})
  tree = response.json()["tree"]
  print("TREE: ", tree)
  
  response = client.post("/claims/", json={"comments" : comments, "tree" : tree}) 
  claims = response.json()["claims_tree"]
  print("CLAIMS: ", claims)

  response = client.put("/sort_claims_tree/", json={"tree" : claims}) #pets_claims_4o}) #claims})
  final_tree = response.json()["tree"]
  print("FINAL TREE: ", final_tree)  


## TODO: uncomment to test :)
#client = TestClient(app)
#test_topic_tree()
#test_claims()
#test_dupes()
#test_full(tiny_pet_comments)
