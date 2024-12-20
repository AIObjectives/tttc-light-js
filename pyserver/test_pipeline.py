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

pet_comments = [{"text" : "I love cats"}, {"text" : "I really really love dogs"},{"text" : "I'm not sure about birds"}, {"text" : "Cats are my favorite"}, {"text" : "Lizards are terrifying"}, \
  {"text" : "Lizards are so friggin scary"}, {"text" : "Dogs are the best"}, {"text":  "No seriously dogs are great"}, {"text" : "Birds I'm hesitant about"}, {"text" : "I'm wild about cats"}, \
  {"text" : "Dogs and cats are both adorable and fluffy"}, {"text" : "Good pets are chill"}, {"text" :"Cats are fantastic"}, {"text" : "Lizards are scary"}, {"text" : "Kittens are so boring"}]

pet_tree_4o = {"tree": {'taxonomy': [{'topicName': 'Pets', 'topicShortDescription': 'General discussion about various types of pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Comments expressing love and opinions about cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Comments expressing love and opinions about dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Comments expressing uncertainty or hesitation about birds.'}, {'subtopicName': 'Lizards', 'subtopicShortDescription': 'Comments expressing fear or dislike of lizards.'}]}]}}

pets_claims_4o = {'Pets': {'total': 17, 'subtopics': {'Cats': {'total': 6, 'claims': [{'claim': 'Cats are the best pets.', 'quote': 'I love cats.', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Cats are superior pets.', 'quote': 'Cats are my favorite.', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Cats are the best pets.', 'quote': "I'm wild about cats", 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Cats are adorable.', 'quote': 'Cats [...] are adorable', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Cats are superior pets.', 'quote': 'Cats are fantastic.', 'topicName': 'Pets', 'subtopicName': 'Cats'}, {'claim': 'Kittens are not engaging pets.', 'quote': 'Kittens are so boring', 'topicName': 'Pets', 'subtopicName': 'Cats'}]}, 'Dogs': {'total': 4, 'claims': [{'claim': 'Dogs are the best pets.', 'quote': 'I really really love dogs.', 'topicName': 'Pets', 'subtopicName': 'Dogs'}, {'claim': 'Dogs are superior to other pets.', 'quote': 'Dogs are the best.', 'topicName': 'Pets', 'subtopicName': 'Dogs'}, {'claim': 'Dogs are superior pets.', 'quote': 'No seriously dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs'}, {'claim': 'Dogs are adorable.', 'quote': 'Dogs [...] are adorable', 'topicName': 'Pets', 'subtopicName': 'Dogs'}]}, 'Birds': {'total': 3, 'claims': [{'claim': 'Birds are not suitable pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds'}, {'claim': 'Birds can be unpredictable pets.', 'quote': "I'm hesitant about birds [...].", 'topicName': 'Pets', 'subtopicName': 'Birds'}, {'claim': 'Birds require specific care that may not suit everyone.', 'quote': "I'm hesitant about birds [...].", 'topicName': 'Pets', 'subtopicName': 'Birds'}]}, 'Lizards': {'total': 3, 'claims': [{'claim': 'Lizards should be avoided as pets.', 'quote': 'Lizards are terrifying.', 'topicName': 'Pets', 'subtopicName': 'Lizards'}, {'claim': 'Lizards should be avoided due to their frightening nature.', 'quote': 'Lizards are so friggin scary', 'topicName': 'Pets', 'subtopicName': 'Lizards'}, {'claim': 'Lizards should be avoided as pets.', 'quote': 'Lizards are scary.', 'topicName': 'Pets', 'subtopicName': 'Lizards'}]}, 'General discussion about various types of pets.': {'total': 1, 'claims': [{'claim': 'Good pets should have a calm demeanor.', 'quote': 'Good pets are chill.', 'topicName': 'Pets', 'subtopicName': 'General discussion about various types of pets.'}]}}}}

