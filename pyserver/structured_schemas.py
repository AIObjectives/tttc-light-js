"""
Pydantic schemas for OpenAI structured outputs.

This module provides dynamic schema generation for constraining LLM outputs
to match the taxonomy structure, preventing naming mismatches between
pipeline stages.
"""

from typing import List
from pydantic import BaseModel, Field, create_model
from enum import Enum


class ClaimBase(BaseModel):
    """Base schema for a claim extracted from a comment."""
    claim: str = Field(description="A concise extracted claim")
    quote: str = Field(description="The exact quote supporting this claim")


class ClaimsResponse(BaseModel):
    """Response schema for claims extraction endpoint."""
    claims: List[ClaimBase]


def create_claims_schema_from_taxonomy(taxonomy: List[dict]) -> type[BaseModel]:
    """
    Dynamically create a Pydantic schema for claims extraction that enforces
    exact topic/subtopic names from the taxonomy.

    Args:
        taxonomy: List of topic objects with structure:
            [
                {
                    "topicName": str,
                    "topicShortDescription": str,
                    "subtopics": [
                        {
                            "subtopicName": str,
                            "subtopicShortDescription": str
                        },
                        ...
                    ]
                },
                ...
            ]

    Returns:
        A Pydantic BaseModel class with constrained topic/subtopic enums.

    Example:
        >>> taxonomy = [{"topicName": "Pets", "subtopics": [{"subtopicName": "Cats"}]}]
        >>> ClaimsSchema = create_claims_schema_from_taxonomy(taxonomy)
        >>> # LLM can now ONLY generate claims with topicName="Pets", subtopicName="Cats"
    """

    # Extract all valid topic names
    topic_names = tuple([topic["topicName"] for topic in taxonomy])

    # Extract all valid subtopic names (across all topics)
    # Note: We use all subtopic names globally to simplify the schema.
    # In theory, we could enforce topic-subtopic relationships, but that
    # requires more complex validation and OpenAI's structured outputs
    # may not support cross-field validation well.
    subtopic_names = []
    for topic in taxonomy:
        for subtopic in topic.get("subtopics", []):
            subtopic_names.append(subtopic["subtopicName"])
    subtopic_names = tuple(subtopic_names)

    if not topic_names or not subtopic_names:
        raise ValueError("Taxonomy must contain at least one topic and subtopic")

    # For OpenAI structured outputs with Pydantic, we use Enum for constraints
    # rather than Literal, as it's more reliable
    from enum import Enum as PyEnum

    TopicEnum = PyEnum('TopicEnum', {name: name for name in topic_names})
    SubtopicEnum = PyEnum('SubtopicEnum', {name: name for name in subtopic_names})

    # Create the Claim model with constrained fields
    Claim = create_model(
        'Claim',
        claim=(str, Field(description="A concise extracted claim")),
        quote=(str, Field(description="The exact quote supporting this claim")),
        topicName=(TopicEnum, Field(description=f"Must be one of: {', '.join(topic_names)}")),
        subtopicName=(SubtopicEnum, Field(description=f"Must be one of: {', '.join(subtopic_names)}")),
        __base__=BaseModel
    )

    # Create the response wrapper
    ClaimsResponse = create_model(
        'ClaimsResponse',
        claims=(List[Claim], Field(description="List of extracted claims")),
        __base__=BaseModel
    )

    return ClaimsResponse


def create_taxonomy_prompt_with_constraints(taxonomy: List[dict]) -> str:
    """
    Create a prompt section that explicitly lists valid taxonomy names WITH descriptions.

    This provides belt-and-suspenders with structured outputs: both the prompt
    AND the schema enforce the same constraints.

    Args:
        taxonomy: List of topic objects with topicName, topicShortDescription, subtopics

    Returns:
        Formatted prompt string listing all valid topics and subtopics with their descriptions
    """
    lines = ["VALID TAXONOMY - YOU MUST USE THESE EXACT NAMES:", ""]

    for topic in taxonomy:
        topic_name = topic['topicName']
        topic_desc = topic.get('topicShortDescription', '')

        if topic_desc:
            lines.append(f"Topic: \"{topic_name}\" - {topic_desc}")
        else:
            lines.append(f"Topic: \"{topic_name}\"")

        subtopics = topic.get("subtopics", [])
        if subtopics:
            for subtopic in subtopics:
                subtopic_name = subtopic['subtopicName']
                subtopic_desc = subtopic.get('subtopicShortDescription', '')

                if subtopic_desc:
                    lines.append(f"  - Subtopic: \"{subtopic_name}\" - {subtopic_desc}")
                else:
                    lines.append(f"  - Subtopic: \"{subtopic_name}\"")
        lines.append("")

    lines.append("YOU MUST ONLY USE THE EXACT TOPIC AND SUBTOPIC NAMES LISTED ABOVE.")
    lines.append("Do not create new names or variations.")
    lines.append("")

    return "\n".join(lines)


# Example usage for testing
if __name__ == "__main__":
    # Example taxonomy
    test_taxonomy = [
        {
            "topicName": "Pets",
            "topicShortDescription": "General opinions about pets",
            "subtopics": [
                {
                    "subtopicName": "Cats",
                    "subtopicShortDescription": "Cats as pets"
                },
                {
                    "subtopicName": "Dogs",
                    "subtopicShortDescription": "Dogs as pets"
                }
            ]
        },
        {
            "topicName": "Transportation",
            "topicShortDescription": "Transportation options",
            "subtopics": [
                {
                    "subtopicName": "Public Transit",
                    "subtopicShortDescription": "Buses and trains"
                }
            ]
        }
    ]

    # Create schema
    ClaimsSchema = create_claims_schema_from_taxonomy(test_taxonomy)

    # Print schema
    print("Generated schema:")
    print(ClaimsSchema.model_json_schema())

    # Print prompt
    print("\n" + "="*50)
    print("Generated prompt constraints:")
    print(create_taxonomy_prompt_with_constraints(test_taxonomy))
