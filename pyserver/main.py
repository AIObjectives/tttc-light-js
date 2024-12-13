#!/usr/bin/env python

from fastapi import FastAPI
from fastapi.testclient import TestClient
import json
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Union
from pyserver.wandblogger import WanbBLogger
import pyserver.schema as schema

import pyserver.config as config
from pyserver.utils import cute_print

class Comment(BaseModel):
  text: str

class CommentList(BaseModel):
  comments: List[Comment]

class CommentTopicTree(BaseModel):
  tree: dict
  comments: List[Comment]

class ClaimTree(BaseModel):
  tree: dict 

# allow client to override model & all prompts
class ClientLLMConfig(BaseModel):
  model: str
  system_prompt: str
  comment_to_tree_prompt: str
  comment_to_claims_prompt: str
  claim_dedup_prompt: str 

app = FastAPI()

@app.get("/")
def read_root():
  # TODO: setup/relevant defaults?
  return {"Hello": "World"}

###################################
# Step 1: Comments to Topic Tree  #
#---------------------------------#
@app.post("/topic_tree/")
def comments_to_tree(comments: schema.CommentList, log_to_wandb:bool = False):
  """
  Given the full list of comments, return the tree of topics and subtopics
  """
  client = OpenAI()

  # TODO: client overrides of prompt!
  # append comments to prompt
  full_prompt = config.COMMENT_TO_TREE_PROMPT
  for comment in comments.comments:
    full_prompt += "\n" + comment.text

  response = client.chat.completions.create(
    model=config.MODEL,
    messages=[
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
    tree = json.loads(response.choices[0].message.content)
  except:
    print("Step 1: no topic tree: ", response)
    tree = {}
  usage = response.usage
    
  if log_to_wandb:
    log = WanbBLogger(config.MODEL, config.WANDB_PROJECT_NAME)
    log.step1(tree, comments, usage)

  return {"tree" : tree, "usage" : usage}

def comment_to_claims(comment:str, tree:dict)-> dict:
  """
  Given a comment and the topic tree, extract one or more claims from the comment.
  Place each claim under the correct subtopic in the tree
  """
  client = OpenAI()

  # add taxonomy and comment to prompt template
  full_prompt = config.COMMENT_TO_CLAIMS_PROMPT
  taxonomy_string = json.dumps(tree)
   
  # TODO: prompt nit, shorten this to just "Comment:"
  full_prompt += "\n" + taxonomy_string + "\nAnd then here is the comment:\n" + comment

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
    claims = response.choices[0].message.content
  except:
    print("Step 2: no response: ", response)
    claims = {}
  return {"claims" : json.loads(claims), "usage" : response.usage}

####################################
# Step 2: Extract and place claims #
#----------------------------------#
@app.post("/claims/")
def all_comments_to_claims(tree:CommentTopicTree, log_to_wandb:bool = False) -> dict:
  comms_to_claims = []
  comms_to_claims_html = []
  TK_2_IN = 0
  TK_2_OUT = 0
  TK_2_TOT = 0

  node_counts = {}

  # TODO: batch this so we're not sending the tree each time
  for comment in tree.comments: 
    response = comment_to_claims(comment.text, tree.tree)
    try:
      claims = response["claims"]
    except:
      print("Step 2: no claims for comment: ", response)
      claims = None
    # reference format
    #{'claims': [{'claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs'}]} 
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
  #[{'claim': 'Cats are the best household pets.', 'quote': 'I love cats', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs'}, {'claim': 'Birds are not suitable pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds'}]
 
  # count the claims in each subtopic 
  for claim in comms_to_claims:
    if "topicName" in claim:
      if claim["topicName"] in node_counts:
        node_counts[claim["topicName"]]["total"] += 1
        if "subtopicName" in claim:
          if claim["subtopicName"] in node_counts[claim["topicName"]]["subtopics"]:
            node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]]["total"] += 1
            node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]]["claims"].append(claim["claim"])
          else:
            node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]] = { "total" : 1, "claims" : [claim["claim"]]}
      else:
        node_counts[claim["topicName"]] = {"total" : 1, "subtopics" : {claim["subtopicName"] : {"total" : 1, "claims" : [claim["claim"]]}}}


  if log_to_wandb:
    log = WanbBLogger(config.MODEL, config.WANDB_PROJECT_NAME)
    log.step2(comms_to_claims_html, TK_2_TOT, TK_2_IN, TK_2_OUT)
 
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
    full_prompt += "\nclaimId"+str(i)+ ": " + orig_claim

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
def sort_claims_tree(claims_tree:ClaimTree, sort_type : str = "deduplicate", log_to_wandb: bool = False)-> dict:
  #TODO: do we ever want to deduplicate without sorting? or sort without deduplicating?
  TK_IN = 0
  TK_OUT = 0
  TK_TOT = 0
  
  dupe_counts = {}
  dupe_logs = []
  nested_claims = {}

  if sort_type == "deduplicate": 
    for topic, topic_data in claims_tree.tree.items():
      for subtopic, subtopic_data in topic_data["subtopics"].items():
        # no need to deduplicate single claims
        if subtopic_data["total"] > 1:
          response = dedup_claims(subtopic_data["claims"])
          deduped_claims = response["dedup_claims"]
          usage = response["usage"]

          # check for duplicates
          has_dupes = False
          if "nesting" in deduped_claims:
            for claim_key, claim_vals in deduped_claims["nesting"].items():
              if len(claim_vals) > 0:
                has_dupes = True
                # extract relative index
                claim_id = int(claim_key.split("Id")[1])
                dupe_keys = [int(dupe_claim_key.split("Id")[1]) for dupe_claim_key in claim_vals]
                dupe_counts[subtopic_data["claims"][claim_id]] = dupe_keys

          if has_dupes:
            nested_claims[subtopic] = {"dupes" : deduped_claims, "og" : subtopic_data["claims"]}
            # if dupes were found, send to wandb
            if log_to_wandb:
              dupe_logs.append(["\n".join(subtopic_data["claims"]), json.dumps(deduped_claims, indent=1)])

          TK_TOT += usage.total_tokens
          TK_IN += usage.prompt_tokens
          TK_OUT += usage.completion_tokens
  
  # after counting any duplicates, sort the entire tree so more frequent topics appear first,
  # more frequent subtopics appear first within each topic, 
  # and claims with the most supporting quotes (including duplicates) appear first within each subtopic 
  sorted_tree = {}
  for topic, topic_data in claims_tree.tree.items():
    topic_total = 0
    topic_list = {}
    for subtopic, subtopic_data in topic_data["subtopics"].items():
      topic_total += subtopic_data["total"]
      if subtopic in nested_claims:
        # this one has some dupes
        # for each duplicate claim, we list the duplicate ids
        # but we don't currently merge them as "similar claims"
        rerank = {}
        for c in subtopic_data["claims"]:
          if c in dupe_counts:
            new_label = c + " (" + str(len(dupe_counts[c]) + 1) + "x:"
            for ckey in dupe_counts[c]:
              new_label += " " + str(ckey) + ","
            new_label += ")"
            rerank[new_label] = len(dupe_counts[c])
          else:
            rerank[c] = 0

        # sort the most-duplicated to the top
        ranked = sorted(rerank.items(), key=lambda x: x[1], reverse=True)
        new_claims = [r[0] for r in ranked]
        topic_list[subtopic] = {"total" : subtopic_data["total"], "claims" : new_claims}
      else:
        topic_list[subtopic] = {"total" : subtopic_data["total"], "claims" : subtopic_data["claims"]}

    # sort subtopics themselves
    sorted_topics = sorted(topic_list.items(), key=lambda x: x[1]["total"], reverse=True)

    sorted_tree[topic] = {"total" : topic_total, "topics" : sorted_topics}

  # sort full tree
  full_sort_tree = sorted(sorted_tree.items(), key=lambda x: x[1]["total"], reverse=True)
 
  if log_to_wandb:
    log = WanbBLogger(config.MODEL, config.WANDB_PROJECT_NAME)
    log.step3(full_sort_tree, dupe_logs, TK_TOT, TK_IN, TK_OUT)
  return {"tree" : full_sort_tree, "per_topic_dupes" : nested_claims, "dupe_counts" : dupe_counts}

#TODO: refactor into separate testing script

######################
# Testing the server #
#--------------------#

sample_tree_4o = {'tree': {'taxonomy': [{'topicName': 'Pets', 'topicShortDescription': 'General opinions about common household pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Positive sentiments towards cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Positive sentiments towards dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Uncertainty or mixed feelings about birds.'}]}]}, 'usage': {'completion_tokens': 125, 'prompt_tokens': 220, 'total_tokens': 345, 'completion_tokens_details': {'accepted_prediction_tokens': 0, 'audio_tokens': 0, 'reasoning_tokens': 0, 'rejected_prediction_tokens': 0}, 'prompt_tokens_details': {'audio_tokens': 0, 'cached_tokens': 0}}}

dupe_claims_4o = {'Pets': {'total': 5, 'subtopics': {'Cats': {'total': 2, 'claims': ['Cats are the best household pets.', 'Cats are superior pets compared to other animals.']}, 'Dogs': {'total': 2, 'claims': ['Dogs are superior pets compared to other animals.', 'Dogs are superior pets.']}, 'Birds': {'total': 1, 'claims': ['Birds are not suitable pets for everyone.']}}}}


def test_topic_tree():
  response = client.post("/topic_tree/?log_to_wandb=True", json={"comments" : [{"text" : "I love cats"},{"text" : "dogs are great"},{"text":"I'm not sure about birds"}]})
  print(response.json())

def test_claims():
  response = client.post("/claims/?log_to_wandb=True", json={"comments" : [{"text" : "I love cats"}, {"text" : "dogs are great"}, {"text" : "dogs are excellent"}, {"text" : "Cats are cool"}, {"text": "I'm not sure about birds"}], "tree" : sample_tree_4o})
  print(response.json())

def test_dupes():
  response = client.put("/sort_claims_tree/?log_to_wandb=True", json={"tree" : dupe_claims_4o})
  print(response.json())

# TODO: uncomment to test :)
#client = TestClient(app)
#test_topic_tree()
#test_claims()
#test_dupes()

