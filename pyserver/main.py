#!/usr/bin/env python

from fastapi import FastAPI
from fastapi.testclient import TestClient
import json
from openai import OpenAI
from pyserver.gpt import ChatGPTClient, BatchLLMCall
from pydantic import BaseModel
from typing import List, Union, Dict
from pyserver.wandblogger import WanbBLogger
import pyserver.schema as schema
from pyserver.prompt import Prompt
from itertools import chain
from collections import defaultdict

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

###################################
# Entire process:
# 
# We want to Take a bunch of comments that people have made and figure out how to organize them into topics and subtopics
# 
# Once we have topics and subtopics, we want to extract claims from peoples comments.
# 
# Then, we want to organize those claims with their topics and subtopics.
#   
# Then, we wnat to go through each of the subtopics and remove claims that are duplicates.
# 
# Note before bed: Step1Tree -> Step2Tree -> Step3Tree
# #
#---------------------------------#

@app.get("/")
def read_root():
  # TODO: setup/relevant defaults?
  return {"Hello": "World"}

###################################
# Step 1: Comments to Topic Tree  #
#---------------------------------#
@app.post("/topic_tree/", response_model=schema.comments_to_tree_response)
async def comments_to_tree(comments: schema.CommentList, log_to_wandb:bool = False):
  """
  Given the full list of comments, return the tree of topics and subtopics
  """
  # TODO: client overrides of prompt!
  llm_client = ChatGPTClient(config.MODEL)
  # Tree, Usage
  gist, usage = await llm_client.call(
    system_prompt=Prompt(config.SYSTEM_PROMPT), 
    # Note: It seems like the way comments are added could be bad if we want to add long, multiline comments and such. Discuss having some seperation token.
    full_prompt=Prompt(config.COMMENT_TO_TREE_PROMPT, *[comment.text for comment in comments.comments]), 
    return_model=schema.DataGist
    )

  return {"data" : { "gist": gist.model_dump(),  "comments": comments.model_dump()}, "usage" : usage.model_dump()}

####################################
# Step 2: Extract and place claims #
#----------------------------------#
@app.post("/claims/")
async def all_comments_to_claims(gist:schema.DataGist, comments:schema.CommentList, log_to_wandb:bool = False):

  batch_llm_client = BatchLLMCall(
    ChatGPTClient(config.MODEL)
  )

  claims_2d_arr, usage = await batch_llm_client.call(
    system_prompt=Prompt(config.SYSTEM_PROMPT),
    full_prompts=[
      # For every comment, create a new prompt asking to extract claims from the comment
      Prompt(
        config.COMMENT_TO_CLAIMS_PROMPT, gist, "Comment:", comment.text
        ) for comment in comments.comments
    ],
    return_model=schema.Extracted_ClaimsList
  )
  
  # Flatten List[List[Claims]] to List[Claims]
  claims = list(chain(*[c.claims for c in claims_2d_arr]))

  return {"data": {'claims': claims, 'gist':gist}, "usage": usage.model_dump()}

# ------------------------------------------------------
# def dedup_claims(claims:list)-> dict:
#   """
#   Given a list of claims for a given subtopic, identify which ones are near-duplicates
#   """
#   client = OpenAI()

#   # add claims with enumerated ids (relative to this subtopic only)
#   full_prompt = config.CLAIM_DEDUP_PROMPT
#   for i, orig_claim in enumerate(claims):
#     full_prompt += "\nclaimId"+str(i)+ ": " + orig_claim

#   response = client.chat.completions.create(
#     model = config.MODEL,
#     messages = [
#       {
#         "role": "system",
#         "content": config.SYSTEM_PROMPT
#       },
#       {
#             "role": "user",
#             "content": full_prompt
#       }
#     ],
#     temperature = 0.0,
#     response_format = {"type": "json_object"}
#   )
#   try:
#     deduped_claims = response.choices[0].message.content
#   except:
#     print("Step 3: no deduped claims: ", response)
#     deduped_claims = {}
#   return {"dedup_claims" : json.loads(deduped_claims), "usage" : response.usage}

def add_duplicates_to_claims(base_claims: List[schema.Base_Claim], nesting_claims: schema.NestingClaims) -> List[schema.Claim]:
    # Create lookup dictionary for quick access by claimId
    claim_lookup = {claim.claimId: claim for claim in base_claims}
    
    result = []
    for parent_id, child_ids in nesting_claims.nesting.items():
        result.append(
            schema.Claim(
                **claim_lookup[parent_id].dict(),  # Copy all base fields
                duplicates=[claim_lookup[child_id] for child_id in child_ids]
            )
        )
    
    return result

#####################################
# Step 3: Sort & deduplicate claims #
#-----------------------------------#
@app.post("/sort_claims_tree/")
async def sort_claims_tree(claims:List[schema.Extracted_Claim], gist:schema.DataGist, sort_type : str = "deduplicate", log_to_wandb: bool = False):

  # map {subtopicName: List[Base_Claim]}
  subtopics_map_to_claims = defaultdict(list)
  for e_claim in claims:
    key = getattr(e_claim, 'subtopicName')
    subtopics_map_to_claims[key].append(e_claim)


  # Base_Claim is just extracted_claim with an id.
  map_with_ids = lambda claim_list: [schema.Base_Claim(claimId=f"claimId{i}", **e_claim.model_dump()) for i,e_claim in enumerate(claim_list)]

  subtopics_map_to_claims_with_ids:Dict[str, List[schema.Base_Claim]] = {key: map_with_ids(value) for key,value in subtopics_map_to_claims.items()}
  
  
  subtopicNames = list(subtopics_map_to_claims_with_ids.keys())
  base_claims_lists = list(subtopics_map_to_claims_with_ids.values())
  # return {'subtopicNames': subtopicNames, 'base_claims_list': base_claims_lists}

  user_prompts = [Prompt(
    config.CLAIM_DEDUP_PROMPT,
    *claim_list
  ) for claim_list in base_claims_lists]

  # print(user_prompts)
  # return "success"
  batch_llm_client = BatchLLMCall(
    ChatGPTClient(config.MODEL)
  )
  
  def remove_empty_from_nesting(payload: dict) -> dict:
      nesting_dict = payload['nesting']
      filtered_nesting = {
          key: value 
          for key, value in nesting_dict.items() 
          if key != ''
      }
      return {'nesting': filtered_nesting}

  nestings, usage = await batch_llm_client.call(
    system_prompt=Prompt(config.SYSTEM_PROMPT),
    full_prompts=user_prompts,
    return_model=schema.NestingClaims,
    preparse_transform=remove_empty_from_nesting
  )

  # return {"nesting":nestings}

  # map the nestings to the base_claims_lists to create our full claims 
  claims_2d_arr:List[List[schema.Claim]] = [add_duplicates_to_claims(base_claims, nesting) for base_claims, nesting in zip(base_claims_lists, nestings)]

  # zip and dict together subtopicNames and our claims_2d_arr. Should result in a map from a subtopicName to its now deduped claims.
  subtopic_claims:Dict[str, List[schema.Claim]] = dict(zip(subtopicNames, claims_2d_arr))
  return {'test': subtopic_claims}
  

  # ----------------------------------------------------------


  # #TODO: do we ever want to deduplicate without sorting? or sort without deduplicating?
  # TK_IN = 0
  # TK_OUT = 0
  # TK_TOT = 0
  
  # dupe_counts = {}
  # dupe_logs = []
  # nested_claims = {}

  # if sort_type == "deduplicate": 
  #   for topic, topic_data in claims_tree.tree.items():
  #     for subtopic, subtopic_data in topic_data["subtopics"].items():
  #       # no need to deduplicate single claims
  #       if subtopic_data["total"] > 1:
  #         response = dedup_claims(subtopic_data["claims"])
  #         deduped_claims = response["dedup_claims"]
  #         usage = response["usage"]

  #         # check for duplicates
  #         has_dupes = False
  #         if "nesting" in deduped_claims:
  #           for claim_key, claim_vals in deduped_claims["nesting"].items():
  #             if len(claim_vals) > 0:
  #               has_dupes = True
  #               # extract relative index
  #               claim_id = int(claim_key.split("Id")[1])
  #               dupe_keys = [int(dupe_claim_key.split("Id")[1]) for dupe_claim_key in claim_vals]
  #               dupe_counts[subtopic_data["claims"][claim_id]] = dupe_keys

  #         if has_dupes:
  #           nested_claims[subtopic] = {"dupes" : deduped_claims, "og" : subtopic_data["claims"]}
  #           # if dupes were found, send to wandb
  #           if log_to_wandb:
  #             dupe_logs.append(["\n".join(subtopic_data["claims"]), json.dumps(deduped_claims, indent=1)])

  #         TK_TOT += usage.total_tokens
  #         TK_IN += usage.prompt_tokens
  #         TK_OUT += usage.completion_tokens
  
  # # after counting any duplicates, sort the entire tree so more frequent topics appear first,
  # # more frequent subtopics appear first within each topic, 
  # # and claims with the most supporting quotes (including duplicates) appear first within each subtopic 
  # sorted_tree = {}
  # for topic, topic_data in claims_tree.tree.items():
  #   topic_total = 0
  #   topic_list = {}
  #   for subtopic, subtopic_data in topic_data["subtopics"].items():
  #     topic_total += subtopic_data["total"]
  #     if subtopic in nested_claims:
  #       # this one has some dupes
  #       # for each duplicate claim, we list the duplicate ids
  #       # but we don't currently merge them as "similar claims"
  #       rerank = {}
  #       for c in subtopic_data["claims"]:
  #         if c in dupe_counts:
  #           new_label = c + " (" + str(len(dupe_counts[c]) + 1) + "x:"
  #           for ckey in dupe_counts[c]:
  #             new_label += " " + str(ckey) + ","
  #           new_label += ")"
  #           rerank[new_label] = len(dupe_counts[c])
  #         else:
  #           rerank[c] = 0

  #       # sort the most-duplicated to the top
  #       ranked = sorted(rerank.items(), key=lambda x: x[1], reverse=True)
  #       new_claims = [r[0] for r in ranked]
  #       topic_list[subtopic] = {"total" : subtopic_data["total"], "claims" : new_claims}
  #     else:
  #       topic_list[subtopic] = {"total" : subtopic_data["total"], "claims" : subtopic_data["claims"]}

  #   # sort subtopics themselves
  #   sorted_topics = sorted(topic_list.items(), key=lambda x: x[1]["total"], reverse=True)

  #   sorted_tree[topic] = {"total" : topic_total, "topics" : sorted_topics}

  # # sort full tree
  # full_sort_tree = sorted(sorted_tree.items(), key=lambda x: x[1]["total"], reverse=True)
 
  # if log_to_wandb:
  #   log = WanbBLogger(config.MODEL, config.WANDB_PROJECT_NAME)
  #   log.step3(full_sort_tree, dupe_logs, TK_TOT, TK_IN, TK_OUT)
  # return {"tree" : full_sort_tree, "per_topic_dupes" : nested_claims, "dupe_counts" : dupe_counts}

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

