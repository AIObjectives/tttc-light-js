#!/usr/bin/env python
import json
from fastapi.testclient import TestClient
from main import app
import config
import os

##################
# Sample inputs  #
#----------------#
min_pets_1 = [{"id":"1", "text":"I love cats", "speaker" : "Alice"}]

speaker_pets_3 = [{"id":"a", "text":"I love cats", "speaker" : "Alice"},\
                {"id":"b", "text":"dogs are great", "speaker" : "Bob"},\
                {"id":"c","text":"I'm not sure about birds", "speaker" : "Charles"}]

longer_pets_15 = [{"id":"0", "text":"I love cats", "speaker" : "Alice"},{"id":"1","text":"I really really love dogs", "speaker" : "Bob"},{"id":"2","text":"I'm not sure about birds", "speaker" : "Charles"},\
  {"id":"3","text" : "Cats are my favorite", "speaker" : "Dany"},{"id":"4","text" : "Lizards are terrifying", "speaker" : "Alice"}, {"id":"5", "text" : "Lizards are so friggin scary", "speaker" : "Charles"},\
  {"id":"6","text" : "Dogs are the best", "speaker" : "Elinor"}, {"id":"7","text":  "No seriously dogs are great", "speaker" : "Bob"}, {"id":"8","text" : "Birds I'm hesitant about", "speaker" : "Elinor"},\
  {"id":"9","text" : "I'm wild about cats", "speaker" : "Gary"},{"id":"10","text" : "Dogs and cats are both adorable and fluffy", "speaker" : "Fiona"},{"id":"11","text" : "Good pets are chill", "speaker" : "Elinor"},
  {"id":"12","text" :"Cats are fantastic", "speaker" : "Alice"},{"id":"13","text" : "Lizards are gorgeous and I love them so much", "speaker" : "Elinor"},{"id":"14","text" : "Kittens are so boring", "speaker" : "Fiona"}]

topic_tree_4o = {"taxonomy" : [{'topicName': 'Pets', 'topicShortDescription': 'General opinions about common household pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Positive sentiments towards cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Positive sentiments towards dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Uncertainty or mixed feelings about birds.'}]}]}

dupe_claims_4o_ids = {'Pets': {'total': 5, 'subtopics': {'Cats': {'total': 2, 'claims': [{'claim': 'Cats are the best household pets.', 'quote': 'I love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'a'}, {'claim': 'Cats are the best household pets.', 'quote': 'I really really love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'd'}]}, 'Dogs': {'total': 1, 'claims': [{'claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs', 'commentId': 'b'}]}, 'Birds': {'total': 2, 'claims': [{'claim': 'Birds are not ideal pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'c'}, {'claim': 'There is uncertainty about birds as pets.', 'quote': "I don't know about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'e'}]}}}}

dupe_claims_4o_speakers = {'Pets': {'total': 5, 'subtopics': {'Cats': {'total': 2, 'claims': [{'claim': 'Cats are the best household pets.', 'quote': 'I love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'a', "speaker" : "Alice"}, {'claim': 'Cats are the best household pets.', 'quote': 'I really really love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'd', "speaker" : "Dany"}]}, 'Dogs': {'total': 1, 'claims': [{'claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs', 'commentId': 'b', "speaker" : "Bob"}]}, 'Birds': {'total': 2, 'claims': [{'claim': 'Birds are not ideal pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'c', "speaker" : "Charles"}, {'claim': 'There is uncertainty about birds as pets.', 'quote': "I don't know about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'e', "speaker" : "Elinor"}]}}}}

#################
# Shared config #
#---------------#
# NOTE: gpt-4o-mini is cheaper/better for basic tests, but it fails on some very basic deduplication
base_llm = {
  "model_name" : "gpt-4o-mini",
  "system_prompt": config.SYSTEM_PROMPT
}

# utils: maximize readability
def json_print(json_obj):
  print(json.dumps(json_obj,indent=4))

################
# Auth & tests #
#--------------#
# set in env shell when running tests
API_KEY = os.getenv('OPENAI_API_KEY')
# various header cases
valid_headers = {"openai-api-key" : API_KEY}
bad_headers = {"openai-api-key" : "sk-proj-123456789"}
no_headers = {}

###############
# Basic tests #
#-------------#

def test_topic_tree(comments=speaker_pets_3, headers=valid_headers):
  llm = base_llm
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments}
  response = client.post("/topic_tree/", json=request, headers=headers)
  json_print(response.json())

def test_claims(comments=speaker_pets_3, headers=valid_headers):
  llm = base_llm
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : topic_tree_4o}
  response = client.post("/claims/", json=request, headers=headers)
  print(json.dumps(response.json(), indent=4))

def test_dupes(claims_tree=dupe_claims_4o_speakers, headers=valid_headers):
  llm = base_llm
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : claims_tree, "sort" : "numPeople"}
  response = client.put("/sort_claims_tree/", json=request, headers=headers)
  print(json.dumps(response.json(), indent=4))

def test_full_pipeline(comments=speaker_pets_3, headers=valid_headers):
  print("Step 1: Topic tree\n\n")
  llm = base_llm
  # fancier model for more precise deduplication
  llm.update({"model_name" : "gpt-4-turbo-preview"})
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments} 
  tree = client.post("/topic_tree/", json=request, headers=headers).json()["data"]
  json_print(tree)

  print("\n\nStep 2: Claims\n\n")
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : {"taxonomy" :tree}}
  claims = client.post("/claims/", json=request, headers=headers).json()["data"]
  json_print(claims)

  print("\n\nStep 3: Dedup & sort\n\n")
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : claims , "sort" : "numPeople"}
  full_tree = client.put("/sort_claims_tree/", json=request, headers=headers)
  print(json.dumps(full_tree.json(), indent=4))

#################
# W&B log tests #
#---------------#

def test_wb_topic_tree(comments=speaker_pets_3, headers=valid_headers):
  llm = base_llm
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments}
  response = client.post("/topic_tree/?log_to_wandb=local_test_0", json=request, headers=headers)
  json_print(response.json())

def test_wb_claims(headers=valid_headers):
  llm = base_llm
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : dupes_pets_5, "tree" : topic_tree_4o}
  response = client.post("/claims/?log_to_wandb=local_test_0", json=request, headers=headers)
  json_print(response.json())

def test_wb_dupes(headers=valid_headers):
  llm = base_llm
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : dupe_claims_4o_ids}
  response = client.put("/sort_claims_tree/?log_to_wandb=local_test_0", json=request, headers=headers)
  json_print(response.json())

def test_wb_full_pipeline(comments=speaker_pets_3, headers=valid_headers):
  print("Step 1: Topic tree\n\n")
  llm = base_llm
  # fancier model for more precise deduplication
  llm.update({"model_name" : "gpt-4o"})
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments} 
  tree = client.post("/topic_tree/?log_to_wandb=local_test_0", json=request, headers=headers).json()["data"]
  json_print(tree)

  print("\n\nStep 2: Claims\n\n")
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : {"taxonomy" :tree}}
  claims = client.post("/claims/?log_to_wandb=local_test_0", json=request, headers=headers).json()["data"]
  json_print(claims)

  print("\n\nStep 3: Dedup & sort\n\n")
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : claims }
  full_tree = client.put("/sort_claims_tree/?log_to_wandb=local_test_0", json=request, headers=headers)
  json_print(full_tree.json())


#############
# Run tests #
#-----------#
client = TestClient(app)

#test_claims(longer_pets_15)
#test_dupes()
#test_claims(headers=valid_headers)
#test_dupes(headers=bad_headers)
#test_full_pipeline(longer_pets_15, headers=bad_headers)

#test_wb_topic_tree(headers=bad_headers)
#test_wb_claims()
#test_wb_dupes()
test_wb_full_pipeline(longer_pets_15, headers=valid_headers)

# TODO: test with edge case inputs
# TODO: add assertions
# assert response.status_code == 200
# assert response.json() == {"name": "Foo", "price": 42}