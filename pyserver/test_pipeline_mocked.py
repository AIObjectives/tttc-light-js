#!/usr/bin/env python
"""
Properly mocked tests for the T3C pipeline that don't require real OpenAI API keys.
"""
import json
import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from main import app
import config

client = TestClient(app)

# Sample test data
min_pets_3 = [
    {"id":"1", "text":"I love cats", "speaker" : "Alice"},
    {"id":"2","text":"dogs are great", "speaker": "Bob"},
    {"id":"3","text":"I'm not sure about birds", "speaker" : "Charles"}
]

speaker_pets_3 = [
    {"id":"a", "text":"I love cats", "speaker" : "Alice"},
    {"id":"b", "text":"dogs are great", "speaker" : "Bob"},
    {"id":"c","text":"I'm not sure about birds", "speaker" : "Charles"}
]

# Mock response data
mock_topic_tree_response = {
    "taxonomy": [
        {
            "topicName": "Pets",
            "topicShortDescription": "General opinions about common household pets.",
            "subtopics": [
                {"subtopicName": "Cats", "subtopicShortDescription": "Positive sentiments towards cats."},
                {"subtopicName": "Dogs", "subtopicShortDescription": "Positive sentiments towards dogs."},
                {"subtopicName": "Birds", "subtopicShortDescription": "Uncertainty or mixed feelings about birds."}
            ]
        }
    ]
}

mock_claims_response = [
    {
        "topicName": "Pets",
        "subtopics": [
            {
                "subtopicName": "Cats",
                "claims": [
                    {
                        "claimId": "claim_1",
                        "text": "I love cats",
                        "people": ["Alice"],
                        "numPeople": 1
                    }
                ]
            },
            {
                "subtopicName": "Dogs", 
                "claims": [
                    {
                        "claimId": "claim_2",
                        "text": "Dogs are great",
                        "people": ["Bob"],
                        "numPeople": 1
                    }
                ]
            }
        ]
    }
]

mock_openai_usage = {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
}

def create_mock_openai_response(content):
    """Create a mock OpenAI API response"""
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message = Mock()
    mock_response.choices[0].message.content = json.dumps(content)
    mock_response.usage = Mock()
    mock_response.usage.prompt_tokens = mock_openai_usage["prompt_tokens"]
    mock_response.usage.completion_tokens = mock_openai_usage["completion_tokens"]  
    mock_response.usage.total_tokens = mock_openai_usage["total_tokens"]
    mock_response.usage.model_dump.return_value = mock_openai_usage
    return mock_response

class TestPipelineEndpoints:
    
    @patch('main.OpenAI')
    def test_topic_tree_endpoint(self, mock_openai_class):
        """Test the topic tree endpoint with mocked OpenAI"""
        # Setup mock
        mock_client = Mock()
        mock_openai_class.return_value = mock_client
        mock_client.chat.completions.create.return_value = create_mock_openai_response(mock_topic_tree_response)
        
        # Test data
        request_data = {
            "llm": {
                "model_name": "gpt-4o-mini",
                "system_prompt": config.SYSTEM_PROMPT,
                "user_prompt": config.COMMENT_TO_TREE_PROMPT
            },
            "comments": min_pets_3
        }
        
        # Make request
        response = client.post(
            "/topic_tree", 
            json=request_data, 
            headers={"X-OpenAI-API-Key": "mock-api-key"}
        )
        
        # Assertions
        assert response.status_code == 200
        response_json = response.json()
        assert "data" in response_json
        assert "usage" in response_json
        assert "cost" in response_json
        assert response_json["data"] == mock_topic_tree_response["taxonomy"]

    @patch('main.OpenAI')
    def test_claims_endpoint(self, mock_openai_class):
        """Test the claims endpoint with mocked OpenAI"""
        # Setup mock
        mock_client = Mock()
        mock_openai_class.return_value = mock_client
        mock_client.chat.completions.create.return_value = create_mock_openai_response(mock_claims_response)
        
        # Test data
        request_data = {
            "llm": {
                "model_name": "gpt-4o-mini", 
                "system_prompt": config.SYSTEM_PROMPT,
                "user_prompt": config.COMMENT_TO_CLAIMS_PROMPT
            },
            "comments": min_pets_3,
            "tree": {"taxonomy": mock_topic_tree_response["taxonomy"]}
        }
        
        # Make request
        response = client.post(
            "/claims",
            json=request_data,
            headers={"X-OpenAI-API-Key": "mock-api-key"}
        )
        
        # Assertions
        assert response.status_code == 200
        response_json = response.json()
        assert "data" in response_json
        assert "usage" in response_json
        assert "cost" in response_json

    @patch('main.OpenAI') 
    def test_full_pipeline_mocked(self, mock_openai_class):
        """Test the complete pipeline with mocked OpenAI responses"""
        # Setup mock
        mock_client = Mock()
        mock_openai_class.return_value = mock_client
        
        # Step 1: Topic tree
        mock_client.chat.completions.create.return_value = create_mock_openai_response(mock_topic_tree_response)
        
        request_data = {
            "llm": {
                "model_name": "gpt-4o-mini",
                "system_prompt": config.SYSTEM_PROMPT, 
                "user_prompt": config.COMMENT_TO_TREE_PROMPT
            },
            "comments": speaker_pets_3
        }
        
        response = client.post(
            "/topic_tree",
            json=request_data,
            headers={"X-OpenAI-API-Key": "mock-api-key"}
        )
        
        assert response.status_code == 200
        tree_data = response.json()["data"]
        
        # Step 2: Claims
        mock_client.chat.completions.create.return_value = create_mock_openai_response(mock_claims_response)
        
        request_data["llm"]["user_prompt"] = config.COMMENT_TO_CLAIMS_PROMPT
        request_data["tree"] = {"taxonomy": tree_data}
        
        response = client.post(
            "/claims", 
            json=request_data,
            headers={"X-OpenAI-API-Key": "mock-api-key"}
        )
        
        assert response.status_code == 200
        claims_data = response.json()["data"]
        
        # Verify we got the expected structure - the claims endpoint returns a dict, not a list
        assert isinstance(claims_data, dict)
        assert len(claims_data) > 0

    def test_endpoint_requires_api_key(self):
        """Test that endpoints require API key header"""
        request_data = {
            "llm": {
                "model_name": "gpt-4o-mini",
                "system_prompt": config.SYSTEM_PROMPT,
                "user_prompt": config.COMMENT_TO_TREE_PROMPT
            },
            "comments": min_pets_3
        }
        
        # Request without API key should fail
        response = client.post("/topic_tree", json=request_data)
        assert response.status_code == 422  # FastAPI validation error

    def test_health_endpoint(self):
        """Test the basic health endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        assert response.json() == {"Hello": "World"}

if __name__ == "__main__":
    pytest.main([__file__])