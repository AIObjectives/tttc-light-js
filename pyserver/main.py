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
import os
import sys
from pathlib import Path
from fastapi import FastAPI
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Union
import wandb
import json

# Add the current directory to path for imports
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

import config
from utils import cute_print

app = FastAPI() 

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
  api_key: str
 
class CommentsLLMConfig(BaseModel):
  comments: List[Comment]   
  llm: LLMConfig

class CommentTopicTree(BaseModel):
  comments: List[Comment]
  llm: LLMConfig
  tree: dict

class Claim(BaseModel):
  claim: str
  commentId: str
  quote: str
  speaker: str
  topicName: str
  subtopicName: str

class ClaimList(BaseModel):
  claims: List[Claim]
  tree: dict

class ClaimTreeLLMConfig(BaseModel):
  tree: dict
  llm: LLMConfig
  sort : str

class CruxesLLMConfig(BaseModel):
  crux_tree: dict
  llm: LLMConfig
  topics: list

app = FastAPI()

if __name__ == "__main__":
  import uvicorn
  port = int(os.getenv("PORT", 8000))
  uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

@app.get("/")
def read_root():
  # TODO: setup/relevant defaults?
  return {"Hello": "World"}

###################################
# Step 1: Comments to Topic Tree  #
#---------------------------------#
@app.post("/topic_tree/")
def comments_to_tree(req: CommentsLLMConfig, log_to_wandb:str = "") -> dict:
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
  api_key = req.llm.api_key
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
    
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
               group=exp_group_name)
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
        "step_taxonomy/model" : req.llm.model_name,
        "step_taxonomy/prompt" : req.llm.user_prompt,
        # token counts
        "U_tok_N/taxonomy": usage.total_tokens,
        "U_tok_in/taxonomy" : usage.prompt_tokens,
        "U_tok_out/taxonomy": usage.completion_tokens
      })
    except:
      print("Failed to create wandb run")
  #NOTE:we could return a dictionary with one key "taxonomy", or the raw taxonomy list directly
  # choosing the latter for now 
  return {"data" : tree["taxonomy"], "usage" : usage.model_dump()}

def comment_to_claims(llm:dict, comment:str, tree:dict)-> dict:
  """
  Given a comment and the full taxonomy/topic tree for the report, extract one or more claims from the comment.
  """
  api_key = llm.api_key
  client = OpenAI(
    api_key=api_key
  )

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


############################################
# Step 2A: Extract claims from N comments #
#------------------------------------------#
@app.post("/batch_N_claims/")
def N_comments_to_claims(req:CommentTopicTree, log_to_wandb:str = "") -> dict:
  """ Given N comments, extract claims for each and return the result """
  comms_to_claims = []
  comms_to_claims_html = []

  TK_2_IN = 0
  TK_2_OUT = 0
  TK_2_TOT = 0

  for comment in req.comments:
    # TODO: could split this up further if each comment is very long
    response = comment_to_claims(req.llm, comment.text, req.tree)
    try:
       claims = response["claims"]
       for claim in claims["claims"]:
         claim.update({'commentId': comment.id, 'speaker' : comment.speaker})
    except:
      print("Step 2: no claims for comment: ", response)
      claims = None
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
      # TODO: do we log each batch? we just want to append, there may be a LOT of these...
  
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
                 group=exp_group_name,
                 resume="allow")
      wandb.log({
        "U_tok_N/claims" : TK_2_TOT,
        "U_tok_in/claims": TK_2_IN,
        "U_tok_out/claims" : TK_2_OUT,
        "rows_to_claims" : wandb.Table(
                           data=comms_to_claims_html,
                           columns = ["comments", "claims"])
      })
    except:
      print("Failed to log wandb run")
 
  net_usage = {"total_tokens" : TK_2_TOT,
               "prompt_tokens" : TK_2_IN,
               "completion_tokens" : TK_2_OUT}

  return {"data" : comms_to_claims, "usage" : net_usage}

#############################################
# Step 2B: Merge & sort k batches of claims #      
#-------------------------------------------#
@app.post("/merge_claim_batches/")
def merge_claim_batches(req:ClaimList, log_to_wandb:str = "") -> dict:
  node_counts = {}
  # count the claims in each subtopic 
  for claim in req.claims:
    if not claim.topicName:
      print("claim unassigned to topic: ", claim.claim)
      continue
    if claim.topicName in node_counts:
      node_counts[claim.topicName]["total"] += 1
      node_counts[claim.topicName]["speakers"].add(claim.speaker)
      if claim.subtopicName:
        if claim.subtopicName in node_counts[claim.topicName]["subtopics"]:
          node_counts[claim.topicName]["subtopics"][claim.subtopicName]["total"] += 1
          node_counts[claim.topicName]["subtopics"][claim.subtopicName]["claims"].append(claim)
          node_counts[claim.topicName]["subtopics"][claim.subtopicName]["speakers"].add(claim.speaker)
        else:
          node_counts[claim.topicName]["subtopics"][claim.subtopicName] = { "total" : 1, "claims" : [claim], "speakers" : set([claim.speaker])}
    else:
      node_counts[claim.topicName] = { "total" : 1, "speakers" : set([claim.speaker]),
                                          "subtopics" : {claim.subtopicName : 
                                            {"total" : 1,
                                             "claims" : [claim],
                                             "speakers" : set([claim.speaker])
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
  empty_usage = {"total_tokens" : 0,
               "prompt_tokens" : 0,
               "completion_tokens" : 0}
  return {"data" : node_counts, "usage" : empty_usage}  

####################################
# Step 2: Extract and place claims #
#----------------------------------#
@app.post("/claims/")
def all_comments_to_claims(req:CommentTopicTree, log_to_wandb:str = "") -> dict:
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
       for claim in claims["claims"]:
         claim.update({'commentId': comment.id, 'speaker' : comment.speaker})
    except:
      print("Step 2: no claims for comment: ", response)
      claims = None
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
  # Note: we will now be sending speaker names to W&B  
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
                 group=exp_group_name)
      wandb.log({
        "U_tok_N/claims" : TK_2_TOT,
        "U_tok_in/claims": TK_2_IN,
        "U_tok_out/claims" : TK_2_OUT,
        "rows_to_claims" : wandb.Table(
                           data=comms_to_claims_html,
                           columns = ["comments", "claims"]),
         "step_claims/model" : req.llm.model_name,
         "step_claims/prompt" : req.llm.user_prompt
      })
    except:
      print("Failed to log wandb run")
 
  net_usage = {"total_tokens" : TK_2_TOT,
               "prompt_tokens" : TK_2_IN,
               "completion_tokens" : TK_2_OUT}

  return {"data" : node_counts, "usage" : net_usage}

def dedup_claims(claims:list, llm:LLMConfig)-> dict:
  """
  Given a list of claims for a given subtopic, identify which ones are near-duplicates
  """
  api_key = llm.api_key
  client = OpenAI(
    api_key=api_key
  )

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
def sort_claims_tree(req:ClaimTreeLLMConfig, log_to_wandb:str = "")-> dict:
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
          response = dedup_claims(subtopic_data["claims"], llm=llm)
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
 
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
                 group = exp_group_name)
      report_data = [[json.dumps(full_sort_tree, indent=2)]]
      wandb.log({
        "U_tok_N/dedup" : TK_TOT,
        "U_tok_in/dedup": TK_IN,
        "U_tok_out/dedup" : TK_OUT,
        "deduped_claims" : wandb.Table(data=dupe_logs, columns = ["full_flat_claims", "deduped_claims"]),
        "t3c_report" : wandb.Table(data=report_data, columns = ["t3c_report"]),
        "step_dedup/model" : req.llm.model_name,
        "step_dedup/prompt" : req.llm.user_prompt
      })
    except:
      print("Failed to create wandb run")
  net_usage = {"total_tokens" : TK_TOT,
               "prompt_tokens" : TK_IN,
               "completion_tokens" : TK_OUT}

  return {"data" : full_sort_tree, "usage" : net_usage} 

def topic_desc_map(topics:list)->dict:
  """ Convert a list of topics into a dictionary returning the short description for 
      each topic name. Note this currently assumes we have no duplicate topic/subtopic
      names, which ideally we shouldn't :)
  """
  topic_desc = {}
  for topic in topics:
    topic_desc[topic["topicName"]] = topic["topicShortDescription"]
    if "subtopics" in topic:
      for subtopic in topic["subtopics"]:
        topic_desc[subtopic["subtopicName"]] = subtopic["subtopicShortDescription"]
  return topic_desc

# TODO: likely deprecate, we'll have a global map
def pseudonymize_speakers(claims:list)->dict:
  """ Create sequential ids for speakers so actual names are not sent to an LLM and do not
  bias the output
  """
  speaker_ids = {}
  # set([claim["speaker"] for claim in claims])
  for claim in claims:
    if "speaker" in claim:
      if claim["speaker"] not in speaker_ids:
        curr_id = len(speaker_ids)
        speaker_ids[claim["speaker"]] = str(curr_id)
  return speaker_ids

def confusion_matrix(conf_mat:list)->list:
  """ Compute confusion matrix"""
  cm = [[0 for a in range(len(conf_mat))] for b in range(len(conf_mat))]
  #we're gonna loop through all the crux statements,
  for claim_index, row in enumerate(conf_mat):
    claim = row[0]
    # these are the scores for each speaker
    per_speaker_scores = row[1:]
    for score_index, score in enumerate(per_speaker_scores):
      # we want this speaker's scores for all statements except current one
      other_scores = [item[score_index+1] for item in conf_mat[claim_index +1:]]
      for other_index, other_score in enumerate(other_scores):
        if score != other_score:
          if score == 0 or other_score == 0:
            cm[claim_index][claim_index+other_index+1] += 0.5
            cm[claim_index+other_index+1][claim_index] += 0.5
          else:
            cm[claim_index][claim_index + other_index+1] += 1
            cm[claim_index + other_index+1][claim_index] += 1
  return cm

def cruxes_for_topic(llm:dict, topic:str, topic_desc:str, claims:list, speaker_map:dict)-> dict:
  api_key = llm.api_key
  client = OpenAI(
    api_key=api_key
  )
  claims_anon = []
  for claim in claims:
    if "speaker" in claim:
      speaker_anon = speaker_map[claim["speaker"]]
      speaker_claim =  speaker_anon + ":" + claim["claim"]
      claims_anon.append(speaker_claim)

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
  return {"crux" : json.loads(crux), "usage" : response.usage }

def get_speakers_map(tree:dict):
  speakers = set()
  for topic, topic_details in tree.items():
    for subtopic, subtopic_details in topic_details["subtopics"].items():
      # all claims for subtopic
      claims = subtopic_details["claims"]
      for claim in claims:
        speakers.add(claim["speaker"])
  speaker_list = list(speakers)
  speaker_list.sort()
  speaker_map = {}
  for i, s in enumerate(speaker_list):
    speaker_map[s] = str(i)
  return speaker_map


#@app.post("/cruxes/")
# TODO: configure optional TS calling, logic for extracting cruxes
def cruxes_from_tree(req:CruxesLLMConfig, log_to_wandb:str = "")-> dict:
  """ Given a topic, description, and corresponding list of claims, extract the
  crux claims that would best split the claims into agree/disagree sides
  Note: currently we do this for the subtopic level, could scale up to main topic?
  Note: let's pass in previous output, without dedup/sorting
  """  
 ##('World-Building', {'total': 7, 'topics': [('Cultural Extrapolation',
  #{'total': 3, 'claims': [{'claim': 'World-building is essential for immersive storytelling.', 
  #'quote': 'Interesting world-building [...]', 'speaker': 'Charles', 'topicName': 'World-Building', 'subtopicName': 'Cultural Extrapolation', 
  #'commentId': '3', 'duplicates': []}, 
  #{'claim': 'Historically-grounded depictions of alien cultures enhance storytelling.', 'quote': "I'm especially into historically-grounded depictions or extrapolations of possible cultures [...].", 'speaker': 'Charles', 'topicName': 'World-Building', 'subtopicName': 'Cultural Extrapolation', 'commentId': ' 8', 'duplicates': []}, {'claim': 'Exploring alternative cultural evolutions in storytelling is valuable.', 'quote': 'how could our universe evolve differently?', 'speaker': 'Charles', 'topicName': 'World-Building', 'subtopicName': 'Cultural Extrapolation', 'commentId': ' 8', 'duplicates': []}], 'speakers': {'Charles'}}), ('Advanced Technology', {'total': 4, 'claims': [{'claim': 'Space operatic battles enhance storytelling.', 'quote': 'More space operatic battles [...].', 'speaker': 'Bob', 'topicName': 'World-Building', 'subtopicName': 'Advanced Technology', 'commentId': '7', 'duplicates': []}, {'claim': 'Detailed descriptions of advanced technology are essential.', 'quote': 'detailed descriptions of advanced futuristic technology [...].', 'speaker': 'Bob', 'topicName': 'World-Building', 'subtopicName': 'Advanced Technology', 'commentId': '7', 'duplicates': []}, {'claim': 'Faster than light travel should be included in narratives.', 'quote': 'perhaps faster than light travel [...].', 'speaker': 'Bob', 'topicName': 'World-Building', 'subtopicName': 'Advanced Technology', 'commentId': '7', 'duplicates': []}, {'claim': 'Quantum computing is a valuable theme in storytelling.', 'quote': 'or quantum computing? [...].', 'speaker': 'Bob', 'topicName': 'World-Building', 'subtopicName': 'Advanced Technology', 'commentId': '7', 'duplicates': []}], 'speakers': {'Bob'}})], 'speakers': {'Charles', 'Bob'}}), 
  cruxes = []
  crux_data = []
  crux_claims = []
  TK_IN = 0
  TK_OUT = 0
  TK_TOT = 0
  topic_desc = topic_desc_map(req.topics)
  
  # TODO: can we get this from client?
  speaker_map = get_speakers_map(req.crux_tree)
  print(speaker_map)
  for topic, topic_details in req.crux_tree.items():
    subtopics = topic_details["subtopics"]
    for subtopic, subtopic_details in subtopics.items():
      # all claims for subtopic
      claims = subtopic_details["claims"]
      if subtopic in topic_desc:
        subtopic_desc = topic_desc[subtopic]
      else:
        print("no description for subtopic:", subtopic)
        subtopic_desc = "No further details"
      topic_title = topic + ", " + subtopic
      llm_response = cruxes_for_topic(req.llm, topic_title, subtopic_desc, claims, speaker_map)
      crux = llm_response["crux"]["crux"]
      usage = llm_response["usage"]

      print(crux)
      
      if log_to_wandb:
        cruxes.append(crux)
        ids_to_speakers = {v : k for k, v in speaker_map.items()}
        spoken_claims = [c["speaker"] + ": " + c["claim"] for c in claims]
        crux_data.append([topic_title, subtopic_desc, json.dumps(spoken_claims,indent=1), json.dumps(crux,indent=1)])

        crux_claim = crux["cruxClaim"]
        agree = crux["agree"]
        disagree = crux["disagree"]
        explanation = crux["explanation"]

        # let's sanitize the agree/disagree:
        agree = [a.split(":")[0] for a in agree]
        disagree = [a.split(":")[0] for a in disagree]

        # add full name to each speaker
        named_agree = [a + ":" + ids_to_speakers[a] for a in agree]
        named_disagree = [d + ":" + ids_to_speakers[d] for d in disagree]
        crux_claims.append([crux_claim, named_agree, named_disagree])

      TK_TOT += usage.total_tokens
      TK_IN += usage.prompt_tokens
      TK_OUT += usage.completion_tokens

  print(crux_claims)
  # Note: we will now be sending speaker names to W&B  
  if log_to_wandb:
    try:
      exp_group_name = str(log_to_wandb)
      wandb.init(project = config.WANDB_PROJECT_NAME,
                 group=exp_group_name
                 )

      # compute confusion matrix
      speaker_labels = sorted(speaker_map.keys())
      conf_mat = []
      for row in crux_claims:
        claim_scores = []
        for sl in speaker_labels:
          # get the id
          labeled_speaker = speaker_map[sl] + ":" +sl
          if labeled_speaker in row[1]:
            claim_scores.append(1)
          elif labeled_speaker in row[2]:
            claim_scores.append(0.5)
          else:
            claim_scores.append(0)
        cm = [row[0]]
        cm.extend(claim_scores)
        conf_mat.append(cm)
    
      cols = ["crux"]
      cols.extend(speaker_labels)

      full_confusion_matrix = confusion_matrix(conf_mat)
      print(full_confusion_matrix)
      # TODO: render the image?
      #claims_only = [row[0] for row in crux_claims]
      #print(claims_only)
      #filename = show_confusion_matrix(full_confusion_matrix, claims_only, "Test Conf Mat", "conf_mat_test.jpg")

      wandb.log({
        "U_tok_N/cruxes" : TK_TOT,
        "U_tok_in/cruxes": TK_IN,
        "U_tok_out/cruxes" : TK_OUT,
        "crux_explain" : wandb.Table(data=crux_data,
                               columns = ["topic", "description", "claims", "crux_explain"]),
        "crux_YN" : wandb.Table(data=crux_claims, columns = ["crux", "agree", "disagree"]),
        "step_cruxes/model" : req.llm.model_name,
        "step_cruxes/prompt" : req.llm.user_prompt
      })
      wandb.log({
        "crux_binary_conf_mat" : wandb.Table(data=conf_mat, columns = cols),
        "actual_cmat" : wandb.Table(data=full_confusion_matrix,
                      columns=["Crux " + str(i) for i in range(len(full_confusion_matrix))])
       # "conf_mat_img" : wandb.Image(filename)

      })
    except:
      print("Failed to log wandb run")
 
  net_usage = {"total_tokens" : TK_TOT,
               "prompt_tokens" : TK_IN,
               "completion_tokens" : TK_OUT}

  return {"data" : cruxes, "usage" : net_usage}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)