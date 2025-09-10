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
min_pets_3 = [{"id":"1", "text":"I love cats", "speaker" : "Alice"},{"id":"2","text":"dogs are great", "speaker": "Bob"},{"id":"3","text":"I'm not sure about birds", "speaker" : "Charles"}]
pets_conflict = [{"id":"1", "text":"I love cats", "speaker" : "Alice"},{"id":"2","text":"dogs are great", "speaker": "Bob"},\
                {"id":"3","text":"I don't really like dogs because I've been bitten by some aggressive ones", "speaker" : "Alice"},\
                {"id":"4","text":"I don't like cats, they're so aloof and they don't really care about anyone ", "speaker": "Bob"}]



dupes_pets_5 = [{"id":"a", "text":"I love cats", "speaker": "Alice"},{"id":"b", "text":"dogs are great", "speaker": "Charles"},{"id":"c","text":"I'm not sure about birds", "speaker": "Bob"},\
        {"id":"d","text":"I really really love cats", "speaker": "Fiona"},{"id":"e","text":"I don't know about birds", "speaker": "Stan"}]

longer_pets_15 = [{"id":"0", "text":"I love cats", "speaker" : "Alice"},{"id":"1","text":"I really really love dogs", "speaker" : "Bob"},{"id":"2","text":"I'm not sure about birds", "speaker" : "Charles"},\
  {"id":"3","text" : "Cats are my favorite", "speaker" : "Dany"},{"id":"4","text" : "Lizards are terrifying", "speaker" : "Alice"}, {"id":"5", "text" : "Lizards are so friggin scary", "speaker" : "Charles"},\
  {"id":"6","text" : "Dogs are the best", "speaker" : "Elinor"}, {"id":"7","text":  "No seriously dogs are great", "speaker" : "Bob"}, {"id":"8","text" : "Birds I'm hesitant about", "speaker" : "Elinor"},\
  {"id":"9","text" : "I'm wild about cats", "speaker" : "Gary"},{"id":"10","text" : "Dogs and cats are both adorable and fluffy", "speaker" : "Fiona"},{"id":"11","text" : "Good pets are chill", "speaker" : "Elinor"},
  {"id":"12","text" :"Cats are fantastic", "speaker" : "Alice"},{"id":"13","text" : "Lizards are gorgeous and I love them so much", "speaker" : "Elinor"},{"id":"14","text" : "Kittens are so boring", "speaker" : "Fiona"}]

topic_tree_4o = {"taxonomy" : [{'topicName': 'Pets', 'topicShortDescription': 'General opinions about common household pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Positive sentiments towards cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Positive sentiments towards dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Uncertainty or mixed feelings about birds.'}]}]}

speaker_pets_3 = [{"id":"a", "text":"I love cats", "speaker" : "Alice"},\
                {"id":"b", "text":"dogs are great", "speaker" : "Bob"},\
                {"id":"c","text":"I'm not sure about birds", "speaker" : "Charles"}]
            ##    {"id":"d","text":"I really really love cats"},{"id":"e","text":"I don't know about birds"}]

fancy_scifi_15 = [{"text" : "More epic fantasy worlds","speaker" : "Alice","id": "1"},\
{"text" : "Better conversations between characters","speaker" : "Bob","id": "2"},\
{"text" : "Interesting world-building","speaker" : "Charles","id": "3"},\
{"text" : "Plausible paths to utopia","speaker" : "Dany","id": "4"},\
{"text" : "Magical elements where individuals are special and beloved by the universe","speaker" : "Elinor","id": "5"},\
{"text" : "Long journeys where the characters encounter profound challenges and learn something new about themselves","speaker" : "Alice","id": "6"},\
{"text" : "More space operatic battles and detailed descriptions of advanced futuristic technology, perhaps faster than light travel, or quantum computing? Math theory also works","speaker" : "Bob","id": "7"},\
{"text" : "I'm especially into historically-grounded depictions or extrapolations of possible cultures, communities, art forms of aliens, how could our universe evolve differently?","speaker" : "Charles","id": "8"},\
{"text" : "Like a special gift, an incredibly powerful talisman from an old witch, being the long-lost princess of a kingdom—but also of course being empowered to make your own decisions and make the sacrifices and earn the scars of leadership, not just be handed the throne","speaker" : "Dany","id": "9"},\
{"text" : "Generalizing to our culture learning to understand others, accepting them, expanding the circle of empathy","speaker" : "Elinor","id": "10"},\
{"text" : "I like really fast-paced plot, almost cinematic, the play-by-play of long elaborate battles or quests, none of that touchy-feely stuff", "speaker" : "Dany", "id" : "11"},\
{"text" : "Emotionally realistic and rich relationships, how characters get to know each other and understand each other, I find that most interesting and compelling", "speaker" : "Alice", "id" : "12"},\
{"text" : "I love really long stories with multiple installments, fully exploring one amazing universe", "speaker" : "Charles", "id" : "13"},\
{"text" : "I don't like magic tricks, or powerful amulets or spells or deus ex machina spontaneous rescues for everyon—I want a scientific or technological explanation", "speaker" : "Bob", "id": "14"},\
{"text" : "When I read sequels, the second book in a series is often the best, and then it's like they run out of material and it gets boring. With the exception of Adrian Tchaikovsky", "speaker": "Alice", "id": "15"}
]

# NOTE: gpt-4o-mini is cheaper/better for basic tests, but it fails on some very basic deduplication
API_KEY = os.getenv('OPENAI_API_KEY')
base_llm = {
  "model_name" : "gpt-5-mini",
  "system_prompt": config.SYSTEM_PROMPT,
  "api_key" : API_KEY
}

def require_api_key():
    """Decorator to skip tests that require a real OpenAI API key"""
    import pytest
    return pytest.mark.skipif(
        not API_KEY or API_KEY.startswith('test-'),
        reason="Requires a valid OpenAI API key"
    )

dupe_claims_4o_ids = {'Pets': {'total': 5, 'subtopics': {'Cats': {'total': 2, 'claims': [{'claim': 'Cats are the best household pets.', 'quote': 'I love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'a'}, {'claim': 'Cats are the best household pets.', 'quote': 'I really really love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'd'}]}, 'Dogs': {'total': 1, 'claims': [{'claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs', 'commentId': 'b'}]}, 'Birds': {'total': 2, 'claims': [{'claim': 'Birds are not ideal pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'c'}, {'claim': 'There is uncertainty about birds as pets.', 'quote': "I don't know about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'e'}]}}}}

dupe_claims_4o_speakers = {'Pets': {'total': 5, 'subtopics': {'Cats': {'total': 2, 'claims': [{'claim': 'Cats are the best household pets.', 'quote': 'I love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'a', "speaker" : "Alice"}, {'claim': 'Cats are the best household pets.', 'quote': 'I really really love cats', 'topicName': 'Pets', 'subtopicName': 'Cats', 'commentId': 'd', "speaker" : "Dany"}]}, 'Dogs': {'total': 1, 'claims': [{'claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'topicName': 'Pets', 'subtopicName': 'Dogs', 'commentId': 'b', "speaker" : "Bob"}]}, 'Birds': {'total': 2, 'claims': [{'claim': 'Birds are not ideal pets for everyone.', 'quote': "I'm not sure about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'c', "speaker" : "Charles"}, {'claim': 'There is uncertainty about birds as pets.', 'quote': "I don't know about birds.", 'topicName': 'Pets', 'subtopicName': 'Birds', 'commentId': 'e', "speaker" : "Elinor"}]}}}}


sample_sorted_tree = [{"topicName": "Pets", "topicShortDescription": "Pet preferences", "subtopics": [{"subtopicName": "Cats", "subtopicShortDescription": "Cat opinions", "claims": [{"claim": "Cats are great pets", "quote": "I love cats"}]}]}]

# maximize readability
def json_print(json_obj):
  print(json.dumps(json_obj,indent=4))

###############
# Basic tests #
#-------------#

@require_api_key()
def test_topic_tree(comments=min_pets_3):
  llm = base_llm.copy()
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments}
  headers = {"X-OpenAI-API-Key": llm.get("api_key") or "test-key-placeholder"}
  response = client.post("/topic_tree/", json=request, headers=headers)
  json_print(response.json())

@require_api_key()
def test_claims(comments=dupes_pets_5):
  llm = base_llm.copy()
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : topic_tree_4o}
  headers = {"X-OpenAI-API-Key": llm.get("api_key") or "test-key-placeholder"}
  response = client.post("/claims/", json=request, headers=headers)
  print(json.dumps(response.json(), indent=4))

@require_api_key()
def test_dupes(claims_tree=dupe_claims_4o_speakers):
  llm = base_llm.copy()
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : claims_tree, "sort" : "numPeople"}
  headers = {"X-OpenAI-API-Key": llm.get("api_key") or "test-key-placeholder"}
  response = client.put("/sort_claims_tree/", json=request, headers=headers)
  print(json.dumps(response.json(), indent=4))


@require_api_key()
def test_topic_summaries():
  llm = base_llm.copy()
  llm.update({"user_prompt" : config.TOPIC_SUMMARY_PROMPT})
  request ={"llm" : llm, "tree" : sample_sorted_tree}
  headers = {"X-OpenAI-API-Key": llm.get("api_key") or "test-key-placeholder"}
  response = client.post("/topic_summaries", json=request, headers=headers)
  json_print(response.json())

@require_api_key()
def test_cruxes(comments=longer_pets_15):
  llm = base_llm.copy()
  llm.update({"model_name" : "gpt-4-turbo-preview"})
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments} 
  headers = {"X-OpenAI-API-Key": llm.get("api_key") or "test-key-placeholder"}
  taxonomy = client.post("/topic_tree/", json=request, headers=headers).json()
  json_print(taxonomy)

  print("\n\nStep 2: Claims\n\n")
  llm.update({"model_name" : "gpt-4o-mini"})
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : {"taxonomy" :taxonomy}}
  claims = client.post("/claims/", json=request, headers=headers).json()
  json_print(claims)

  print("\n\nStep 3: Cruxes\n\n")
  llm.update({"user_prompt" : config.CRUX_PROMPT})
  request ={"llm" : llm, "topics" : taxonomy, "tree" : claims}
  cruxes = client.post("/cruxes/", json=request, headers=headers) #.json()["data"]
  print(cruxes)

@require_api_key()
def test_full_pipeline(comments=dupes_pets_5):
  print("Step 1: Topic tree\n\n")
  llm = base_llm.copy()
  # fancier model for more precise deduplication
  llm.update({"model_name" : "gpt-4-turbo-preview"})
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments} 
  headers = {"X-OpenAI-API-Key": llm.get("api_key") or "test-key-placeholder"}
  tree = client.post("/topic_tree/", json=request, headers=headers).json()
  json_print(tree)

  print("\n\nStep 2: Claims\n\n")
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : {"taxonomy" :tree}}
  claims = client.post("/claims/", json=request, headers=headers).json()
  json_print(claims)

  print("\n\nStep 3: Dedup & sort\n\n")
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : claims["data"] , "sort" : "numPeople"}
  full_tree = client.put("/sort_claims_tree/", json=request, headers=headers)
  print(json.dumps(full_tree.json(), indent=4))

  print("\n\nStep 4: Create Topic Summaries\n\n")
  llm.update({"user_prompt" : config.TOPIC_SUMMARY_PROMPT})
  request ={"llm" : llm, "tree": full_tree.json() }
  summaries = client.post("/topic_summaries", json=request, headers=headers)
  print(json.dumps(summaries.json(), indent=4))


#################
# W&B log tests #
#---------------#

def test_wb_topic_tree():
  llm = base_llm
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : min_pets_3}
  response = client.post("/topic_tree/?log_to_wandb=local_test_0", json=request)
  json_print(response.json())

def test_wb_claims():
  llm = base_llm
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : dupes_pets_5, "tree" : topic_tree_4o}
  response = client.post("/claims/?log_to_wandb=local_test_0", json=request)
  json_print(response.json())

def test_wb_dupes():
  llm = base_llm
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : dupe_claims_4o_ids}
  response = client.put("/sort_claims_tree/?log_to_wandb=local_test_0", json=request)
  json_print(response.json())

def test_wb_topic_summaries():
  llm = base_llm
  llm.update({"user_prompt" : config.TOPIC_SUMMARY_PROMPT})
  request ={"llm" : llm, "tree" : sample_sorted_tree}
  response = client.post("/topic_summaries?log_to_wandb=local_test_0", json=request)
  json_print(response.json())

@require_api_key()
def test_wb_full_pipeline(comments=dupes_pets_5):
  print("Step 1: Topic tree\n\n")
  llm = base_llm
  headers = {"X-OpenAI-API-Key": llm.get("api_key") or "test-key-placeholder"}
  # fancier model for more precise deduplication
  llm.update({"model_name" : "gpt-4o"})
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments} 
  tree = client.post("/topic_tree/?log_to_wandb=local_test_0", json=request, headers=headers).json()
  json_print(tree)

  print("\n\nStep 2: Claims\n\n")
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : {"taxonomy" :tree}}
  claims = client.post("/claims/?log_to_wandb=local_test_0", json=request, headers=headers).json()
  json_print(claims)

  print("\n\nStep 3: Dedup & sort\n\n")
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : claims }
  full_tree = client.put("/sort_claims_tree/?log_to_wandb=local_test_0", json=request, headers=headers)
  print(full_tree)
  #.json()["data"]
  #json_print(full_tree)

  print("\n\nStep 4: Create Topic Summaries\n\n")
  llm.update({"user_prompt" : config.TOPIC_SUMMARY_PROMPT})
  request ={"llm" : llm, "tree": full_tree.json() }
  summaries = client.post("/topic_summaries/?log_to_wandb=local_test_0", json=request, headers=headers)
  print(json.dumps(summaries.json(), indent=4))

@require_api_key()
def test_wb_cruxes_pipeline(comments=pets_conflict):

  print("Step 1: Topic tree\n\n")
  llm = base_llm
  # fancier model for more precise deduplication
  llm.update({"model_name" : "gpt-4o-mini"})
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments} 
  taxonomy = client.post("/topic_tree/?log_to_wandb=tavern", json=request).json()
  json_print(taxonomy)

  print("\n\nStep 2: Claims\n\n")
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : {"taxonomy" : taxonomy}}
  claims = client.post("/claims/?log_to_wandb=tavern", json=request).json()
  json_print(claims)

  print("\n\nStep 3: Cruxes\n\n")
  llm.update({"user_prompt" : config.CRUX_PROMPT})
  request ={"llm" : llm, "topics" : taxonomy, "tree" : claims}
  cruxes = client.post("/cruxes/?log_to_wandb=tavern", json=request) #.json()["data"]
  json_print(cruxes.json())


@require_api_key()
def test_from_json(json_file="test_comments.json"):

  with open(json_file, 'r', encoding='utf-8') as jsonfile:
    comments = json.load(jsonfile)

  print("Step 1: Topic tree\n\n")
  llm = base_llm
  # fancier model for more precise deduplication
  llm.update({"model_name" : "gpt-4o"})
  llm.update({"user_prompt" : config.COMMENT_TO_TREE_PROMPT})
  request ={"llm" : llm, "comments" : comments} 
  taxonomy = client.post("/topic_tree/?log_to_wandb=full_log", json=request).json()
  json_print(taxonomy)

  print("\n\nStep 2: Claims\n\n")
  llm.update({"model_name" : "gpt-4o"})
  llm.update({"user_prompt" : config.COMMENT_TO_CLAIMS_PROMPT})
  request ={"llm" : llm, "comments" : comments, "tree" : {"taxonomy" : taxonomy}}
  claims = client.post("/claims/?log_to_wandb=full_log", json=request).json()
  json_print(claims)

  print("\n\nStep 3: Cruxes\n\n")
  llm.update({"model_name" : "gpt-4o"})
  llm.update({"user_prompt" : config.CRUX_PROMPT})
  request ={"llm" : llm, "topics" : taxonomy, "crux_tree" : claims}
  cruxes = client.post("/cruxes/?log_to_wandb=full_log", json=request) #.json()["data"]
  print(cruxes)

  print("\n\nStep 4: Also dedup & sort\n\n")
  llm.update({"model_name" : "gpt-4o-mini"})
  llm.update({"user_prompt" : config.CLAIM_DEDUP_PROMPT})
  request ={"llm" : llm, "tree" : claims,  "sort" : "numPeople"}
  full_tree = client.put("/sort_claims_tree/?log_to_wandb=full_log", json=request)
  print(full_tree)

#############
# Run tests #
#-----------#
client = TestClient(app)
#test_from_json()

#test_wb_cruxes_pipeline(fancy_scifi_15) #fancy_scifi_15)
#test_topic_tree(fancy_scifi_10)
#test_full_pipeline(fancy_scifi_10)
#test_cruxes(pets_conflict)

@require_api_key()
def test_integration_full_pipeline():
    """Integration test that requires a real API key"""
    test_full_pipeline(speaker_pets_3)

if __name__ == "__main__":
    if API_KEY and not API_KEY.startswith('test-'):
        test_full_pipeline(speaker_pets_3)
    else:
        print("Skipping integration test - no valid OpenAI API key found")
        print("Use mocked tests with: python -m pytest test_pipeline_mocked.py")
#test_claims(longer_pets_15)
#test_dupes()

#test_topic_tree(speaker_pets_3)
#test_claims()
#test_dupes()
#test_full_pipeline(longer_pets_15)

#test_wb_topic_tree()
#test_wb_claims()
#test_wb_dupes()
#test_wb_full_pipeline(longer_pets_15)

# TODO: test with edge case inputs
# TODO: add assertions
# assert response.status_code == 200
# assert response.json() == {"name": "Foo", "price": 42}
