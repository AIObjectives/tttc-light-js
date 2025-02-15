from unittest.mock import MagicMock

# Mock responses similar to our TypeScript implementation
mock_responses = {
    "topic_tree": {
        "taxonomy": [{
            "topicName": "Pets",
            "topicShortDescription": "General opinions about common household pets.",
            "subtopics": [
                {
                    "subtopicName": "Cats",
                    "subtopicShortDescription": "Positive sentiments towards cats."
                },
                {
                    "subtopicName": "Dogs",
                    "subtopicShortDescription": "Positive sentiments towards dogs."
                },
                {
                    "subtopicName": "Birds",
                    "subtopicShortDescription": "Uncertainty or mixed feelings about birds."
                }
            ]
        }]
    },
    "claims": {
        "Pets": {
            "total": 3,
            "subtopics": {
                "Cats": {
                    "total": 1,
                    "claims": [{
                        "claim": "Cats are wonderful pets.",
                        "quote": "I love cats",
                        "topicName": "Pets",
                        "subtopicName": "Cats",
                        "commentId": "a"
                    }]
                },
                "Dogs": {
                    "total": 1,
                    "claims": [{
                        "claim": "Dogs make great pets.",
                        "quote": "dogs are great",
                        "topicName": "Pets",
                        "subtopicName": "Dogs",
                        "commentId": "b"
                    }]
                },
                "Birds": {
                    "total": 1,
                    "claims": [{
                        "claim": "Birds may not be suitable pets for everyone.",
                        "quote": "I'm not sure about birds",
                        "topicName": "Pets",
                        "subtopicName": "Birds",
                        "commentId": "c"
                    }]
                }
            }
        }
    },
    "topic_tree_legacy": {
        "data": {
            "taxonomy": mock_responses["topic_tree"]["taxonomy"]
        },
        "usage": {
            "completion_tokens": 100,
            "prompt_tokens": 50,
            "total_tokens": 150
        }
    },
    "claims_legacy": {
        "data": mock_responses["claims"],
        "usage": {
            "completion_tokens": 100,
            "prompt_tokens": 50,
            "total_tokens": 150
        }
    }
}

class MockOpenAI:
    def __init__(self):
        self.chat = MagicMock()
        self.chat.completions.create = self.mock_completion

    async def mock_completion(self, model, messages, **kwargs):
        content = messages[1]["content"].lower()
        
        # Support both old and new endpoint formats
        if "topic tree" in content:
            response = mock_responses["topic_tree_legacy"] if "/topic_tree/" in content else mock_responses["topic_tree"]
        else:
            response = mock_responses["claims_legacy"] if "/claims/" in content else mock_responses["claims"]
        
        return MagicMock(
            choices=[MagicMock(
                message=MagicMock(
                    content=str(response)
                )
            )],
            usage=MagicMock(
                total_tokens=100,
                prompt_tokens=50,
                completion_tokens=50
            )
        ) 