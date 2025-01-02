#!/usr/bin/env python
import json
from fastapi.testclient import TestClient
from main import app
import config

##################
# Sample inputs  #
#----------------#

min_pets_1 = [{"id":"1", "text":"I love cats"}]
min_pets_3 = [{"id":"1", "text":"I love cats"},{"id":"2","text":"dogs are great"},{"id":"3","text":"I'm not sure about birds"}]
dupes_pets_5 = [{"id":"a", "text":"I love cats"},{"id":"b", "text":"dogs are great"},{"id":"c","text":"I'm not sure about birds"},\
                {"id":"d","text":"I really really love cats"},{"id":"e","text":"I don't know about birds"}]
longer_pets_15 = [{"id":"0", "text":"I love cats"},{"id":"1","text":"I really really love dogs"},{"id":"2","text":"I'm not sure about birds"},\
  {"id":"3","text" : "Cats are my favorite"},{"id":"4","text" : "Lizards are terrifying"}, {"id":"5", "text" : "Lizards are so friggin scary"},\
  {"id":"6","text" : "Dogs are the best"}, {"id":"7","text":  "No seriously dogs are great"}, {"id":"8","text" : "Birds I'm hesitant about"},\
  {"id":"9","text" : "I'm wild about cats"},{"id":"10","text" : "Dogs and cats are both adorable and fluffy"},{"id":"11","text" : "Good pets are chill"},
  {"id":"12","text" :"Cats are fantastic"},{"id":"13","text" : "Lizards are gorgeous and I love them so much"},{"id":"14","text" : "Kittens are so boring"}]

topic_tree_4o = {"taxonomy" : [{'topicName': 'Pets', 'topicShortDescription': 'General opinions about common household pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Positive sentiments towards cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Positive sentiments towards dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Uncertainty or mixed feelings about birds.'}]}]}

# NOTE: gpt-4o-mini is cheaper/better for basic tests, but it fails on some very basic deduplication
base_llm = {
  "model_name" : "gpt-4o-mini",
  "system_prompt": config.SYSTEM_PROMPT
}

dupe_claims_4o_ids = {'Pets': {'total': 5, 'subtopics': {'Cats': {'total': 2, 'claims': [{'claim': 'Cats are the best household pets.', 'quote': 'I love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'a'}, {'claim': 'Cats are the best household pets.', 'quote': 'I really really love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'd'}]}, 'Dogs': {'total': 1, 'claims': [{'claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs', 'commentId': 'b'}]}, 'Birds': {'total': 2, 'claims': [{'claim': 'Birds are not ideal pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'c'}, {'claim': 'There is uncertainty about birds as pets.', 'quote': "I don't know about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'e'}]}}}}

# maximize readability
def json_print(json_obj):
  print(json.dumps(json_obj,indent=4))

###############
# Basic tests #
#-------------#

def test_topic_tree():
  llm = base_llm
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : min_pets_3}
  response = client.post("/topic_tree/", json=request)
  json_print(response.json())

def test_claims():
  llm = base_llm
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : dupes_pets_5, "tree" : topic_tree_4o}
  response = client.post("/claims/", json=request)
  print(json.dumps(response.json(), indent=4))

def test_dupes():
  llm = base_llm
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : dupe_claims_4o_ids}
  response = client.put("/sort_claims_tree/", json=request)
  print(json.dumps(response.json(), indent=4))

def test_full_pipeline(comments=dupes_pets_5):
  print("Step 1: Topic tree\n\n")
  llm = base_llm
  # fancier model for more precise deduplication
  llm.update({"model_name" : "gpt-4-turbo-preview"})
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments} 
  tree = client.post("/topic_tree/", json=request).json()["data"]
  json_print(tree)

  print("\n\nStep 2: Claims\n\n")
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : {"taxonomy" :tree}}
  claims = client.post("/claims/", json=request).json()["data"]
  json_print(claims)

  print("\n\nStep 3: Dedup & sort\n\n")
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : claims }
  full_tree = client.put("/sort_claims_tree/", json=request).json()["data"]
  json_print(full_tree)

#############
# Run tests #
#-----------#
client = TestClient(app)

test_topic_tree()
test_claims()
test_dupes()

test_full_pipeline(longer_pets_15)

# TODO: test with W&B logging
# TODO: test with edge case inputs
# TODO: add assertions
# assert response.status_code == 200
# assert response.json() == {"name": "Foo", "price": 42}
