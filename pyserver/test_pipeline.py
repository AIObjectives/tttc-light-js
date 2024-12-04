#!/usr/bin/env python

from fastapi.testclient import TestClient
from .main import app

#TODO: try a more principled way to test!

client = TestClient(app)

def test_topic_tree():
    response = client.post("/topic_tree/", json={"comments" : [{"text" : "I love cats"},{"text" : "dogs are great"},{"text":"I'm not sure about birds"}]})
    assert response.status_code == 200
    #assert response.json() == {"name": "Foo", "price": 42}

sample_tree_4o = {'tree': {'taxonomy': [{'topicName': 'Pets', 'topicShortDescription': 'General opinions about common household pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Positive sentiments towards cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Positive sentiments towards dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Uncertainty or mixed feelings about birds.'}]}]}, 'usage': {'completion_tokens': 125, 'prompt_tokens': 220, 'total_tokens': 345, 'completion_tokens_details': {'accepted_prediction_tokens': 0, 'audio_tokens': 0, 'reasoning_tokens': 0, 'rejected_prediction_tokens': 0}, 'prompt_tokens_details': {'audio_tokens': 0, 'cached_tokens': 0}}}

def test_claims():
    response = client.post("/claims/?log_to_wandb=True", json={"comments" : [{"text" : "I love cats"}, {"text" : "dogs are great"}, {"text" : "dogs are excellent"}, {"text" : "Cats are cool"}, {"text": "I'm not sure about birds"}], "tree" : sample_tree_4o})
    print(response.json())

dupe_claims_4o = {'Pets': {'total': 5, 'subtopics': {'Cats': {'total': 2, 'claims': ['Cats are the best household pets.', 'Cats are superior pets compared to other animals.']}, 'Dogs': {'total': 2, 'claims': ['Dogs are superior pets compared to other animals.', 'Dogs are superior pets.']}, 'Birds': {'total': 1, 'claims': ['Birds are not suitable pets for everyone.']}}}}

def test_dupes():
  response = client.put("/sorted_claims/?log_to_wandb=True", json={"tree" : dupe_claims_4o})
  print(response.json())

