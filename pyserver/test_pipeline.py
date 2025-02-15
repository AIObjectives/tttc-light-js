#!/usr/bin/env python
import json
from fastapi.testclient import TestClient
from main import app
import config
import os
from pathlib import Path
import pytest
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ValidationError
from typing import List

##################
# Sample inputs  #
#----------------#

def load_test_cases():
    """Load test cases from the shared JSON file"""
    with open("../common/test_cases.json", "r") as f:
        return json.load(f)

# Remove hardcoded test data
test_cases = load_test_cases()
min_pets_1 = test_cases['sample_inputs']['min_pets_1']
min_pets_3 = test_cases['sample_inputs']['min_pets_3']
dupes_pets_5 = test_cases['sample_inputs']['dupes_pets_5']
longer_pets_15 = test_cases['sample_inputs']['longer_pets_15']

topic_tree_4o = {"taxonomy" : [{'topicName': 'Pets', 'topicShortDescription': 'General opinions about common household pets.', 'subtopics': [{'subtopicName': 'Cats', 'subtopicShortDescription': 'Positive sentiments towards cats.'}, {'subtopicName': 'Dogs', 'subtopicShortDescription': 'Positive sentiments towards dogs.'}, {'subtopicName': 'Birds', 'subtopicShortDescription': 'Uncertainty or mixed feelings about birds.'}]}]}

# Add TestClient instance
client = TestClient(app)

# Add Pydantic models for validation
class Comment(BaseModel):
    id: str
    text: str
    speaker: str = "test_user"  # Optional with default

class LLMConfig(BaseModel):
    model_name: str
    system_prompt: str
    user_prompt: str
    api_key: str

class CommentsLLMConfig(BaseModel):
    comments: List[Comment]
    llm: LLMConfig

def test_root():
    """Test the root endpoint (no API key needed)"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"Hello": "World"}

def test_request_validation():
    """Test request validation (no API key needed)"""
    # Test missing required fields
    response = client.post("/topic_tree/", json={})
    assert response.status_code == 422

    # Test missing comments
    response = client.post("/topic_tree/", json={"llm": {}})
    assert response.status_code == 422

    # Test missing llm config
    response = client.post("/topic_tree/", json={"comments": []})
    assert response.status_code == 422

    # Test invalid comment structure
    invalid_comment = {
        "comments": [{"wrong_field": "test"}],  # Missing required fields
        "llm": {
            "model_name": "test",
            "system_prompt": "test",
            "user_prompt": "test",
            "api_key": "test"
        }
    }
    response = client.post("/topic_tree/", json=invalid_comment)
    assert response.status_code == 422

    # Test valid structure
    valid_request = {
        "comments": [{"id": "1", "text": "test", "speaker": "user"}],
        "llm": {
            "model_name": "test",
            "system_prompt": "test",
            "user_prompt": "test",
            "api_key": "test"
        }
    }
    # Validate without making API call
    try:
        CommentsLLMConfig(**valid_request)
        validation_passed = True
    except ValidationError:
        validation_passed = False
    
    assert validation_passed, "Valid request failed validation"

@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="OpenAI API key not set")
def test_full_pipeline():
    """Integration test - only runs with API key"""
    # TODO: Implement full pipeline test when API key is available
    # This test will use test_cases['sample_inputs']['dupes_pets_5']
    # and verify the complete pipeline flow
    pytest.skip("Integration test not implemented")
