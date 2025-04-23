#! /usr/bin env python
import json
import wandb

import config

def comment_is_meaningful(raw_comment:str):
  """ Check whether the raw comment contains enough words/characters
  to be meaningful in web app mode. Only check word count for short comments.
  TODO: add config for other modes like elicitation/direct response
  """
  if len(raw_comment) >= config.MIN_CHAR_COUNT_FOR_MEANING or len(raw_comment.split(" ")) >= config.MIN_WORD_COUNT_FOR_MEANING:
    return True
  else:
    return False


def token_cost(model_name:str, tok_in:int, tok_out:int):
  """ Returns the cost for the current model running the given numbers of
  tokens in/out for this call """
  if model_name not in config.COST_BY_MODEL:
    print("model undefined!")
    return -1
  return 0.001 * (tok_in  *  config.COST_BY_MODEL[model_name]["in_per_1K"] + tok_out * config.COST_BY_MODEL[model_name]["out_per_1K"])

def cute_print(json_obj):
  """Returns a pretty version of a dictionary as properly-indented and scaled
  json in html for at-a-glance review in W&B"""
  str_json = json.dumps(json_obj, indent=1)
  cute_html = '<pre id="json"><font size=2>' + str_json + "</font></pre>"
  return wandb.Html(cute_html)

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

def full_speaker_map(tree:dict):
  """ Given a full topic tree, collect all distinct speakers for all claims into one set,
  sort alphabetically, then enumerate (so the numerical id of the speaker is deterministic
  from the composition of any particular dataset """
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
