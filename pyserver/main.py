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
from enum import Enum
import json
import math
import os
from pathlib import Path
import sys
from typing import Literal, List, Union

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.security import APIKeyHeader
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel
import wandb

# Add the current directory to path for imports
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

import config
from utils import cute_print, topic_desc_map, full_speaker_map, token_cost

load_dotenv()

class Environment(str, Enum):
    DEV = "dev"
    PROD = "prod"

# Get environment with type safety
def get_environment() -> Environment:
    env = os.getenv("NODE_ENV").lower()
    if env not in [Environment.DEV, Environment.PROD]:
      raise Exception("Environment not set: set NODE_ENV in pyserver/.env to valid value")
    return Environment(env)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        
        # Add HSTS only in production
        if get_environment() == Environment.PROD:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        # Additional security headers - safe for both environments
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        return response
        
app = FastAPI()
# Configure middleware based on environment
environment = get_environment()
if environment == Environment.PROD:
    app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

header_scheme = APIKeyHeader(name="openai-api-key") 
 
@app.get("/")
def read_root():
    return {"Hello": "World"}

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
  sort : str

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
#---------------------------------#
@app.post("/topic_tree")
def comments_to_tree(req: CommentsLLMConfig, api_key: str = Depends(header_scheme), log_to_wandb:str = config.WANDB_GROUP_LOG_NAME) -> dict:
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
  if not api_key:
    raise HTTPException(status_code=401)
  client = OpenAI(
    api_key=api_key
  )

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
  # compute LLM costs for this step's tokens
  s1_total_cost = token_cost(req.llm.model_name, usage.prompt_tokens, usage.completion_tokens)
    
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
               group=exp_group_name,
               resume="allow")
      wandb.config.update({
                "s1_topics/model" : req.llm.model_name,
                "s1_topics/user_prompt" : req.llm.user_prompt,
                "s1_topics/system_prompt" : req.llm.system_prompt
               })
      comment_lengths = [len(c.text) for c in req.comments]
      num_topics = len(tree["taxonomy"])
      subtopic_bins = [len(t["subtopics"]) for t in tree["taxonomy"]]

      # in case comments are empty / for W&B Table logging
      comment_list = "none"
      if len(req.comments) > 1:
        comment_list = "\n".join([c.text for c in req.comments])
      comms_tree_list = [[comment_list, json.dumps(tree["taxonomy"],indent=1)]]
      wandb.log({
        "comm_N" : len(req.comments),
        "comm_text_len": sum(comment_lengths),
        "comm_bins" : comment_lengths,
        "num_topics" : num_topics,
        "num_subtopics" : sum(subtopic_bins),
        "subtopic_bins" : subtopic_bins,
        "rows_to_tree" : wandb.Table(data=comms_tree_list,
                                     columns = ["comments", "taxonomy"]),                
        # token counts
        "U_tok_N/taxonomy": usage.total_tokens,
        "U_tok_in/taxonomy" : usage.prompt_tokens,
        "U_tok_out/taxonomy": usage.completion_tokens,
        "cost/s1_topics" : s1_total_cost,
      })
    except:
      print("Failed to create wandb run")
  #NOTE:we could return a dictionary with one key "taxonomy", or the raw taxonomy list directly
  # choosing the latter for now 
  return {"data" : tree["taxonomy"], "usage" : usage.model_dump(), "cost" : s1_total_cost}

def comment_to_claims(client, llm:dict, comment:str, tree:dict)-> dict:
  """
  Given a comment and the full taxonomy/topic tree for the report, extract one or more claims from the comment.
  """
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
  # TODO: json.loads(claims) fails sometimes 
  try:
    claims_obj = json.loads(claims)
  except:
    print("json_parse_failure;claims:", claims)
    claims_obj = claims
  return {"claims" : claims_obj, "usage" : response.usage}

####################################
# Step 2: Extract and place claims #
#----------------------------------#
@app.post("/claims")
def all_comments_to_claims(req:CommentTopicTree, api_key: str = Depends(header_scheme), log_to_wandb:str = config.WANDB_GROUP_LOG_NAME) -> dict:
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
    ],
    "tree": [
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

  Output format:
  - data: the dictionary of topics and subtopics with extracted claims listed under the
                 correct subtopic, along with the source quote
  - usage: a dictionary of token counts for the LLM calls of this pipeline step
    - completion_tokens
    - prompt_tokens
    - total_tokens
  
  Example output:
  {
    "data": {
        "Pets": {
            "total": 3,
            "subtopics": {
                "Cats": {
                    "total": 1,
                    "claims": [
                        {
                            "claim": "Cats are the best household pets.",
                            "commentId":"c1",
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
                            "commentId":"c2",
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
                            "commentId":"c3",
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
  if not api_key:
    raise HTTPException(status_code=401)
  client = OpenAI(
    api_key=api_key
  )
  comms_to_claims = []
  comms_to_claims_html = []
  TK_2_IN = 0
  TK_2_OUT = 0
  TK_2_TOT = 0

  node_counts = {}
  # TODO: batch this so we're not sending the tree each time
  for comment in req.comments:
    response = comment_to_claims(client, req.llm, comment.text, req.tree)
    try:
       claims = response["claims"]
       for claim in claims["claims"]:
         claim.update({'commentId': comment.id, 'speaker' : comment.speaker})
    except:
      print("Step 2: no claims for comment: ", response)
      claims = None
      continue
    # reference format
    #{'claims': [{'claim': 'Dogs are superior pets.', commentId:'c1', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs'}]} 
    usage = response["usage"]
    if claims and len(claims["claims"]) > 0:
      comms_to_claims.extend([c for c in claims["claims"]])

    TK_2_IN += usage.prompt_tokens
    TK_2_OUT += usage.completion_tokens
    TK_2_TOT += usage.total_tokens

    # format for logging to W&B
    if log_to_wandb:
      viz_claims = cute_print(claims["claims"])
      comms_to_claims_html.append([comment.text, viz_claims])  

  # reference format
  #[{'claim': 'Cats are the best household pets.', 'commentId':'c1', 'quote': 'I love cats', 'speaker' : 'Alice', 'topicName': 'Pets', 'subtopicName': 'Cats'},
  #{'commentId':'c2','claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'speaker' : 'Bob', 'topicName': 'Pets', 'subtopicName': 'Dogs'},
  # {'commentId':'c3', 'claim': 'Birds are not suitable pets for everyone.', 'quote': "I'm not sure about birds.", 'speaker' : 'Alice', 'topicName': 'Pets', 'subtopicName': 'Birds'}]
 
  # count the claims in each subtopic 
  for claim in comms_to_claims:
    if not "topicName" in claim:
      print("claim unassigned to topic: ", claim)
      continue
    if claim["topicName"] in node_counts:
      node_counts[claim["topicName"]]["total"] += 1
      node_counts[claim["topicName"]]["speakers"].add(claim["speaker"])
      if "subtopicName" in claim:
        if claim["subtopicName"] in node_counts[claim["topicName"]]["subtopics"]:
          node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]]["total"] += 1
          node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]]["claims"].append(claim)
          node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]]["speakers"].add(claim["speaker"])
        else:
          node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]] = { "total" : 1, "claims" : [claim], "speakers" : set([claim["speaker"]])}
    else:
      node_counts[claim["topicName"]] = { "total" : 1, "speakers" : set([claim["speaker"]]),
                                          "subtopics" : {claim["subtopicName"] : 
                                            {"total" : 1,
                                             "claims" : [claim],
                                             "speakers" : set([claim["speaker"]])
                                             }
                                        }
                                      }
  # after inserting claims: check if any of the topics/subtopics are empty
  for topic in req.tree["taxonomy"]:
    if "subtopics" in topic:
      for subtopic in topic["subtopics"]:
        # check if subtopic in node_counts
        if topic["topicName"] in node_counts:
          if subtopic["subtopicName"] not in node_counts[topic["topicName"]]["subtopics"]:
            # this is an empty subtopic!
            print("EMPTY SUBTOPIC: ", subtopic["subtopicName"])
            node_counts[topic["topicName"]]["subtopics"][subtopic["subtopicName"]] = { "total" : 0, "claims" : [], "speakers" : set()}
        else:
          # could we have an empty topic? certainly
          print("EMPTY TOPIC: ", topic["topicName"])
          node_counts[topic["topicName"]] = { "total" : 0, "speakers" : set(),
                                          "subtopics" : { "None" : 
                                            {"total" : 0,
                                             "claims" : [],
                                             "speakers" : set()
                                             }
                                        }
                                      }
  # compute LLM costs for this step's tokens
  s2_total_cost = token_cost(req.llm.model_name, TK_2_IN, TK_2_OUT)

  # Note: we will now be sending speaker names to W&B  
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
                 group=exp_group_name,
                 resume="allow")
      wandb.config.update({
                  "s2_claims/model" : req.llm.model_name,
                  "s2_claims/user_prompt" : req.llm.user_prompt,
                  "s2_claims/system_prompt" : req.llm.system_prompt
                 })
      wandb.log({
        "U_tok_N/claims" : TK_2_TOT,
        "U_tok_in/claims": TK_2_IN,
        "U_tok_out/claims" : TK_2_OUT,
        "rows_to_claims" : wandb.Table(
                           data=comms_to_claims_html,
                           columns = ["comments", "claims"]),
        "cost/s2_claims" : s2_total_cost
      })
    except:
      print("Failed to log wandb run")
 
  net_usage = {"total_tokens" : TK_2_TOT,
               "prompt_tokens" : TK_2_IN,
               "completion_tokens" : TK_2_OUT}
  return {"data" : node_counts, "usage" : net_usage, "cost" : s2_total_cost}

def dedup_claims(client, claims:list, llm:LLMConfig)-> dict:
  """
  Given a list of claims for a given subtopic, identify which ones are near-duplicates
  """
  # add claims with enumerated ids (relative to this subtopic only)
  full_prompt = llm.user_prompt
  for i, orig_claim in enumerate(claims):
    full_prompt += "\nclaimId"+str(i)+ ": " + orig_claim["claim"]

  response = client.chat.completions.create(
    model = config.MODEL,
    messages = [
      {
        "role": "system",
        "content": llm.system_prompt
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
  try: 
    deduped_claims_obj = json.loads(deduped_claims)
  except:
    print("json failure;dedup:", deduped_claims)
    deduped_claims_obj = deduped_claims
  return {"dedup_claims" : deduped_claims_obj, "usage" : response.usage}

#####################################
# Step 3: Sort & deduplicate claims #
#-----------------------------------#
@app.put("/sort_claims_tree")
def sort_claims_tree(req:ClaimTreeLLMConfig, api_key: str = Depends(header_scheme), log_to_wandb:str = config.WANDB_GROUP_LOG_NAME)-> dict:
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
                        "commentId":"c1",
                        "quote": "I love cats.",
                        "topicName": "Pets",
                        "subtopicName": "Cats"
                    },
                    {
                        "claim": "Cats are the best pets.",
                        "commentId":"c1",
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
                        "commentId":"c2",
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
                        "commentId":"c3",
                        "quote": "I'm not sure about birds.",
                        "topicName": "Pets",
                        "subtopicName": "Birds"
                    },
                    {
                        "claim": "Birds are not suitable pets for everyone.",
                        "commentId":"c3",
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
  - response object: JSON/dictionary with the following fields
    - data: the deduplicated claims & correctly sorted topic tree / full taxonomy of topics, subtopics, 
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
            "num_speakers" : 5,
            "speakers" : [
                "Alice",
                "Bob",
                "Charles",
                "Dany",
                "Elinor"
            ],
            "num_claims": 5,
            "topics": [
                [
                    "Cats",
                    {
                        "num_claims": 2,
                        "claims": [
                            {
                                "claim": "Cats are the best pets.",
                                "commentId":"c1",
                                "quote": "I love cats.",
                                "speaker" : "Alice",
                                "topicName": "Pets",
                                "subtopicName": "Cats",
                                "duplicates": [
                                    {
                                        "claim": "Cats are the best pets.",
                                        "commendId:"c1"
                                        "quote": "I really really love cats",
                                        "speaker" : "Elinor",
                                        "topicName": "Pets",
                                        "subtopicName": "Cats",
                                        "duplicated": true
                                    }
                                ]
                            }
                        ]
                        "num_speakers" : 2,
                        "speakers" : [
                            "Alice",
                            "Elinor"
                        ]
                    }
                ],
                [
                    "Birds",
                    {
                        "num_claims": 2,
                        "claims": [
                            {
                                "claim": "Birds are not ideal pets for everyone.",
                                "commentId:"c3",
                                "quote": "I'm not sure about birds.",
                                "speaker" : "Charles",
                                "topicName": "Pets",
                                "subtopicName": "Birds",
                                "duplicates": [
                                    {
                                        "claim": "Birds are not suitable pets for everyone.",
                                        "commentId" "c3",
                                        "quote": "I don't know about birds.",
                                        "speaker": "Dany",
                                        "topicName": "Pets",
                                        "subtopicName": "Birds",
                                        "duplicated": true
                                    }
                                ]
                            }
                        ]
                        "num_speakers" : 2,
                        "speakers" : [
                            "Charles",
                            "Dany"
                        ]
                    }
                ],
                [
                    "Dogs",
                    {
                        "num_claims": 1,
                        "claims": [
                            {
                                "claim": "Dogs are superior pets.",
                                "commentId": "c2",
                                "quote": "dogs are great",
                                "speaker" : "Bob",
                                "topicName": "Pets",
                                "subtopicName": "Dogs"
                            }
                        ]
                        "num_speakers" : 1,
                        "speakers" : [
                            "Bob"
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
  if not api_key:
    raise HTTPException(status_code=401)
  client = OpenAI(
    api_key=api_key
  )
  claims_tree = req.tree
  llm = req.llm
  TK_IN = 0
  TK_OUT = 0
  TK_TOT = 0
  dupe_logs = []
  sorted_tree = {} 

  for topic, topic_data in claims_tree.items():
    per_topic_total = 0
    per_topic_list = {}
    # consider the empty top-level topic
    if not topic_data["subtopics"]:
      print("NO SUBTOPICS: ", topic)
    for subtopic, subtopic_data in topic_data["subtopics"].items():
      per_topic_total += subtopic_data["total"]
      per_topic_speakers = set()
      # canonical order of claims: as they appear in subtopic_data["claims"]
      # no need to deduplicate single claims
      if subtopic_data["total"] > 1:
        try:
          response = dedup_claims(client, subtopic_data["claims"], llm=llm)
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
          # - but also we won't have duplicate info bidirectionally — A may be dupe of B, but B not dupe of A
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
        for claim_id, claim in enumerate(subtopic_data["claims"]):
          # add speakers of all claims
          if "speaker" in claim:
            speaker = claim["speaker"]
          else:
            print("no speaker provided:", claim)
            speaker = "unknown"
          per_topic_speakers.add(speaker)

          # only create a new claim if we haven't visited this one already
          if claim_id not in accounted_for_ids:
            clean_claim = {k : v for k, v in claim.items()}
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
          dupe_logs.append([json.dumps(subtopic_data["claims"], indent=1), json.dumps(sorted_deduped_claims, indent=1)])
        
        TK_TOT += usage.total_tokens
        TK_IN += usage.prompt_tokens
        TK_OUT += usage.completion_tokens
      else:
        sorted_deduped_claims = subtopic_data["claims"]
        # there may be one unique claim or no claims if this is an empty subtopic
        if subtopic_data["claims"]:
          if "speaker" in subtopic_data["claims"][0]:
            speaker = subtopic_data["claims"][0]["speaker"]
          else:
            print("no speaker provided:", claim)
            speaker = "unknown"      
          per_topic_speakers.add(speaker)
        else:
          print("EMPTY SUBTOPIC AFTER CLAIMS: ", subtopic)
        
      # track how many claims and distinct speakers per subtopic
      tree_counts = {"claims" : subtopic_data["total"], "speakers" : len(per_topic_speakers)}
      # add list of sorted, deduplicated claims to the right subtopic node in the tree
      per_topic_list[subtopic] = {"claims" : sorted_deduped_claims, 
                                  "speakers": list(per_topic_speakers),
                                  "counts" : tree_counts}

    # sort all the subtopics in a given topic
    # two ways of sorting 1/16:
    # - (default) numPeople: count the distinct speakers per subtopic/topic
    # - numClaims: count the total claims per subtopic/topic
    set_topic_speakers = set()
    for k, c in per_topic_list.items():
      set_topic_speakers = set_topic_speakers.union(c["speakers"])

    if req.sort == "numPeople":
      sorted_subtopics = sorted(per_topic_list.items(), key=lambda x: x[1]["counts"]["speakers"], reverse=True)
    elif req.sort == "numClaims":
      sorted_subtopics = sorted(per_topic_list.items(), key=lambda x: x[1]["counts"]["claims"], reverse=True)
    # track how many claims and distinct speakers per subtopic
    tree_counts = {"claims" : per_topic_total, "speakers" : len(set_topic_speakers)}
    # we have to add all the speakers
    sorted_tree[topic] = { "topics" : sorted_subtopics,
                           "speakers" : list(set_topic_speakers),
                           "counts" : tree_counts}

  # sort all the topics in the tree
  if req.sort == "numPeople":
    full_sort_tree = sorted(sorted_tree.items(), key=lambda x: x[1]["counts"]["speakers"], reverse=True)
  elif req.sort == "numClaims":
    full_sort_tree = sorted(sorted_tree.items(), key=lambda x: x[1]["counts"]["claims"], reverse=True)
 
  # compute LLM costs for this step's tokens
  s3_total_cost = token_cost(req.llm.model_name, TK_IN, TK_OUT)
  
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
                 group = exp_group_name,
                 resume="allow")
      wandb.config.update({
                    "s3_dedup/model" : req.llm.model_name,
                    "s3_dedup/user_prompt" : req.llm.user_prompt,
                    "s3_dedup/system_prompt" : req.llm.system_prompt
                 })

      report_data = [[json.dumps(full_sort_tree, indent=2)]]
      wandb.log({
        "U_tok_N/dedup" : TK_TOT,
        "U_tok_in/dedup": TK_IN,
        "U_tok_out/dedup" : TK_OUT,
        "deduped_claims" : wandb.Table(data=dupe_logs, columns = ["full_flat_claims", "deduped_claims"]),
        "t3c_report" : wandb.Table(data=report_data, columns = ["t3c_report"]),
        "cost/s3_dedup" : s3_total_cost
      })
      # W&B run completion
      wandb.run.finish()
    except:
      print("Failed to create wandb run")
  net_usage = {"total_tokens" : TK_TOT,
               "prompt_tokens" : TK_IN,
               "completion_tokens" : TK_OUT}

  return {"data" : full_sort_tree, "usage" : net_usage, "cost" : s3_total_cost} 

###########################################
# Optional / New Feature & Research Steps #
#-----------------------------------------#
# Steps below are optional/exploratory components of the T3C LLM pipeline.

########################################
# Crux claims and controversy analysis #
#--------------------------------------#
# Our first research feature finds "crux claims" to distill the perspectives
# on each subtopic into the core controversy — summary statements on which speakers
# are most evenly split into "agree" or "disagree" sides.
# We prompt an LLM for a crux claim with an explanation, given all the speakers' claims
# on each subtopic (along with the parent topic and a short description). We anonymize
# the claims before sending them to the LLM to protect PII and minimize any potential bias
# based on known speaker identity (e.g. when processing claims made by popular writers)

def controversy_matrix(cont_mat:list)->list:
  """ Compute a controversy matrix from individual speaker opinions on crux claims,
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
    claim = row[0]
    # these are the scores for each speaker
    per_speaker_scores = row[1:]
    for score_index, score in enumerate(per_speaker_scores):
      # we want this speaker's scores for all statements except current one
      other_scores = [item[score_index+1] for item in cont_mat[claim_index +1:]]
      for other_index, other_score in enumerate(other_scores):
        # if the scores match, there is no controversy — do not add anything
        if score != other_score:
          # we only know one of the opinions
          if score == 0 or other_score == 0:
            cm[claim_index][claim_index+other_index+1] += 0.5
            cm[claim_index+other_index+1][claim_index] += 0.5
          # these opinions are different — max controversy
          else:
            cm[claim_index][claim_index + other_index+1] += 1
            cm[claim_index + other_index+1][claim_index] += 1
  return cm

def cruxes_for_topic(client, llm:dict, topic:str, topic_desc:str, claims:list, speaker_map:dict)-> dict:
  """ For each fully-described subtopic, provide all the relevant claims with an anonymized
  numeric speaker id, and ask the LLM for a crux claim that best splits the speakers' opinions
  on this topic (ideally into two groups of equal size for agreement vs disagreement with the crux claim)
  """
  claims_anon = []
  speaker_set = set()
  for claim in claims:
    if "speaker" in claim:
      speaker_anon = speaker_map[claim["speaker"]]
      speaker_set.add(speaker_anon)
      speaker_claim =  speaker_anon + ":" + claim["claim"]
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
      {
          "role": "system",
          "content": llm.system_prompt
      },
      {
          "role": "user",
          "content": full_prompt
      }
      ],
      temperature=0.0,
      response_format={ "type": "json_object" }
  )
  crux = response.choices[0].message.content
  try:
    crux_obj = json.loads(crux)
  except:
    crux_obj = crux
  return {"crux" : crux_obj, "usage" : response.usage }
<<<<<<< HEAD
  
=======

>>>>>>> main
def top_k_cruxes(cont_mat:list, cruxes:list, top_k:int=0)->list:
  """ Return the top K most controversial crux pairs. 
  Optionally let the caller set K, otherwise default
  to the ceiling of the square root of the number of crux claims.
  """
  if top_k == 0:
    K = min(math.ceil(math.sqrt(len(cruxes))), 10)
  else:
    K = top_k
  top_k_scores = [0.4 for i in range(K)]
  top_k_coords = [{"x" : 0, "y" : 0} for i in range(K)]
  # let's sort a triangular half of the symmetrical matrix (diagonal is all zeros)
  scores = []
  for x in range(len(cont_mat)):
    for y in range(x + 1, len(cont_mat)):
      scores.append([cont_mat[x][y], x, y])
  all_scored_cruxes = sorted(scores, key=lambda x: x[0], reverse=True)
  top_cruxes = [{"score" : score, "cruxA" : cruxes[x], "cruxB" : cruxes[y]} for score, x, y in all_scored_cruxes[:K]]
  return top_cruxes

@app.post("/cruxes")
def cruxes_from_tree(req:CruxesLLMConfig, api_key: str = Depends(header_scheme), log_to_wandb:str = config.WANDB_GROUP_LOG_NAME)-> dict:
  """ Given a topic, description, and corresponding list of claims with numerical speaker ids, extract the
  crux claims that would best split the claims into agree/disagree sides.
  Return a crux for each subtopic of >= 2 claims and >= 2 speakers.
  """ 
  if not api_key:
    raise HTTPException(status_code=401)
  client = OpenAI(
    api_key=api_key
  ) 
  cruxes_main = []
  crux_claims = [] 
  TK_IN = 0
  TK_OUT = 0
  TK_TOT = 0
  topic_desc = topic_desc_map(req.topics)
  
  # TODO: can we get this from client?
  speaker_map = full_speaker_map(req.crux_tree)
  # print("speaker ids: ", speaker_map)
  for topic, topic_details in req.crux_tree.items():
    subtopics = topic_details["subtopics"]
    for subtopic, subtopic_details in subtopics.items():
      # all claims for subtopic
      # TODO: reduce how many subtopics we analyze for cruxes, based on minimum representation
      # in known speaker comments?
      claims = subtopic_details["claims"]
      if len(claims) < 2:
        print("fewer than 2 claims: ", subtopic)
        continue

      if subtopic in topic_desc:
        subtopic_desc = topic_desc[subtopic]
      else:
        print("no description for subtopic:", subtopic)
        subtopic_desc = "No further details"

      topic_title = topic + ", " + subtopic
      llm_response = cruxes_for_topic(client, req.llm, topic_title, subtopic_desc, claims, speaker_map)
      if not llm_response:
        continue
      crux = llm_response["crux"]["crux"]
      usage = llm_response["usage"]
     
      ids_to_speakers = {v : k for k, v in speaker_map.items()}
      spoken_claims = [c["speaker"] + ": " + c["claim"] for c in claims]

      # create more readable table: crux only, named speakers who agree, named speakers who disagree
      crux_claim = crux["cruxClaim"]
      agree = crux["agree"]
      disagree = crux["disagree"]
      try:
        explanation = crux["explanation"]
      except:
        explanation = "N/A"

      # let's add back the names to the sanitized/speaker-ids-only
      # in the agree/disagree claims
      agree = [a.split(":")[0] for a in agree]
      disagree = [a.split(":")[0] for a in disagree]
      named_agree = [a + ":" + ids_to_speakers[a] for a in agree]
      named_disagree = [d + ":" + ids_to_speakers[d] for d in disagree]
      crux_claims.append([crux_claim, named_agree, named_disagree, explanation])

      # most readable form:
      # - crux claim, explanation, agree, disagree
      # - all claims prepended with speaker names
      # - topic & subctopic, description
      cruxes_main.append([crux_claim, explanation, named_agree,
        named_disagree, json.dumps(spoken_claims,indent=1),
        topic_title, subtopic_desc])

      TK_TOT += usage.total_tokens
      TK_IN += usage.prompt_tokens
      TK_OUT += usage.completion_tokens

  # convert agree/disagree to numeric scores:
  # for each crux claim, for each speaker:
  # - assign 1 if the speaker agrees with the crux
  # - assign 0.5 if the speaker disagrees
  # - assign 0 if the speaker's opinion is unknown/unspecified
  speaker_labels = sorted(speaker_map.keys())
  cont_mat = []
  for row in crux_claims:
    claim_scores = []
    for sl in speaker_labels:
      # associate the numeric id with the speaker so the LLM explanation
      # is more easily interpretable (by cross-referencing adjacent columns which have the
      # full speaker name, which is withheld from the LLM)
      labeled_speaker = speaker_map[sl] + ":" +sl
      if labeled_speaker in row[1]:
        claim_scores.append(1)
      elif labeled_speaker in row[2]:
        claim_scores.append(0.5)
      else:
        claim_scores.append(0)
    cm = [row[0]]
    cm.extend(claim_scores)
    cont_mat.append(cm)
  full_controversy_matrix = controversy_matrix(cont_mat)
  
  crux_claims_only = [row[0] for row in crux_claims]
  top_cruxes = top_k_cruxes(full_controversy_matrix, crux_claims_only, req.top_k)
  # compute LLM costs for this step's tokens
  s4_total_cost = token_cost(req.llm.model_name, TK_IN, TK_OUT)

  # Note: we will now be sending speaker names to W&B
  # (still not to external LLM providers, to avoid bias on crux detection and better preserve PII)
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
                 group=exp_group_name,
                 resume="allow")
      wandb.config.update({
                "s4_cruxes/model" : req.llm.model_name,
                "s4_cruxes/prompt" : req.llm.user_prompt
       })
      log_top_cruxes = [[c["score"], c["cruxA"], c["cruxB"]] for c in top_cruxes]
      wandb.log({
        "U_tok_N/cruxes" : TK_TOT,
        "U_tok_in/cruxes": TK_IN,
        "U_tok_out/cruxes" : TK_OUT,
        "cost/s4_cruxes" : s4_total_cost,
        "crux_details" : wandb.Table(data=cruxes_main,
                                  columns=["crux", "reason", "agree", "disagree", "original_claims", "topic, subtopic", "description"]),
        "crux_top_scores" : wandb.Table(data=log_top_cruxes, columns=["score", "cruxA", "cruxB"])                           
      })
      cols = ["crux"]
      cols.extend(speaker_labels)
      wandb.log({
        "crux_binary_scores" : wandb.Table(data=cont_mat, columns = cols),
        "crux_cmat_scores" : wandb.Table(data=full_controversy_matrix,
                      columns=["Crux " + str(i) for i in range(len(full_controversy_matrix))])
      # TODO: render a visual of the controversy matrix 
      # currently matplotlib requires a GUI to generate the plot, which is incompatible with pyserver config
      # filename = show_confusion_matrix(full_confusion_matrix, claims_only, "Test Conf Mat", "conf_mat_test.jpg")
      # "cont_mat_img" : wandb.Image(filename)
      })
    except:
      print("Failed to log wandb run")
 
  # wrap and name fields before returning
  net_usage = {"total_tokens" : TK_TOT,
               "prompt_tokens" : TK_IN,
               "completion_tokens" : TK_OUT}
  cruxes = [{"cruxClaim" : c[0], "agree": c[1], "disagree" : c[2], "explanation" : c[3]} for c in crux_claims]
  crux_response = {
    "cruxClaims" : cruxes,
    "controversyMatrix" : full_controversy_matrix,
    "topCruxes" : top_cruxes,
    "usage" : net_usage,
    "cost" : s4_total_cost
  }
  return crux_response

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
