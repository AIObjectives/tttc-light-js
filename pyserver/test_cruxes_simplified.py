"""
Tests for simplified cruxes implementation.

Tests the three core pure functions:
- calculate_controversy_scores()
- build_speaker_crux_matrix()
- calculate_topic_scores()
"""

import pytest
from main import (
    calculate_controversy_scores,
    build_speaker_crux_matrix,
    calculate_topic_scores,
)


class TestCalculateControversyScores:
    """Test controversy scoring logic."""

    def test_perfect_split_50_50(self):
        """Perfect 50/50 split should give controversyScore = 1.0"""
        agree = ["1:Alice", "2:Bob"]
        disagree = ["3:Charlie", "4:Diana"]
        total = 4

        result = calculate_controversy_scores(agree, disagree, total)

        assert result["agreementScore"] == 0.5
        assert result["disagreementScore"] == 0.5
        assert result["controversyScore"] == 1.0  # min(0.5, 0.5) * 2

    def test_unanimous_agreement(self):
        """Unanimous agreement should give controversyScore = 0.0"""
        agree = ["1:Alice", "2:Bob", "3:Charlie"]
        disagree = []
        total = 3

        result = calculate_controversy_scores(agree, disagree, total)

        assert result["agreementScore"] == 1.0
        assert result["disagreementScore"] == 0.0
        assert result["controversyScore"] == 0.0  # min(1.0, 0.0) * 2

    def test_unanimous_disagreement(self):
        """Unanimous disagreement should give controversyScore = 0.0"""
        agree = []
        disagree = ["1:Alice", "2:Bob", "3:Charlie"]
        total = 3

        result = calculate_controversy_scores(agree, disagree, total)

        assert result["agreementScore"] == 0.0
        assert result["disagreementScore"] == 1.0
        assert result["controversyScore"] == 0.0  # min(0.0, 1.0) * 2

    def test_two_thirds_split(self):
        """2 agree, 1 disagree should give controversyScore = 0.66"""
        agree = ["1:Alice", "2:Bob"]
        disagree = ["3:Charlie"]
        total = 3

        result = calculate_controversy_scores(agree, disagree, total)

        assert result["agreementScore"] == pytest.approx(0.667, abs=0.01)
        assert result["disagreementScore"] == pytest.approx(0.333, abs=0.01)
        assert result["controversyScore"] == pytest.approx(0.666, abs=0.01)  # min * 2

    def test_zero_speakers(self):
        """Zero speakers should return all zeros"""
        result = calculate_controversy_scores([], [], 0)

        assert result["agreementScore"] == 0.0
        assert result["disagreementScore"] == 0.0
        assert result["controversyScore"] == 0.0

    def test_partial_participation(self):
        """Tests scoring when not all speakers in subtopic took clear positions"""
        agree = ["1:Alice"]
        disagree = ["2:Bob"]
        total = 3  # Total speakers in subtopic (e.g., 1 agree + 1 disagree + 1 no_clear_position)

        result = calculate_controversy_scores(agree, disagree, total)

        assert abs(result["agreementScore"] - 0.33) < 0.01  # 1/3
        assert abs(result["disagreementScore"] - 0.33) < 0.01  # 1/3
        assert abs(result["controversyScore"] - 0.66) < 0.01  # min(0.33, 0.33) * 2


class TestBuildSpeakerCruxMatrix:
    """Test Speaker × Crux matrix construction."""

    def test_basic_matrix(self):
        """Build simple 3 speakers × 2 cruxes matrix"""
        subtopic_cruxes = [
            {
                "topic": "AI Safety",
                "subtopic": "Regulation",
                "agree": ["1:Alice", "2:Bob"],
                "disagree": ["3:Charlie"],
            },
            {
                "topic": "Healthcare",
                "subtopic": "Coverage",
                "agree": ["1:Alice"],
                "disagree": ["2:Bob", "3:Charlie"],
            },
        ]
        speakers = ["1:Alice", "2:Bob", "3:Charlie"]

        result = build_speaker_crux_matrix(subtopic_cruxes, speakers)

        assert result["speakers"] == speakers
        assert result["cruxLabels"] == [
            "AI Safety → Regulation",
            "Healthcare → Coverage",
        ]
        assert result["matrix"] == [
            ["agree", "agree"],  # Alice: agrees with both
            ["agree", "disagree"],  # Bob: agrees with first, disagrees with second
            ["disagree", "disagree"],  # Charlie: disagrees with both
        ]

    def test_no_position_handling(self):
        """Speakers with no position should be marked as 'no_position'"""
        subtopic_cruxes = [
            {
                "topic": "Topic",
                "subtopic": "Subtopic",
                "agree": ["1:Alice"],
                "disagree": ["3:Charlie"],
            }
        ]
        speakers = ["1:Alice", "2:Bob", "3:Charlie"]

        result = build_speaker_crux_matrix(subtopic_cruxes, speakers)

        assert result["matrix"] == [
            ["agree"],  # Alice
            ["no_position"],  # Bob has no position
            ["disagree"],  # Charlie
        ]

    def test_empty_input(self):
        """Empty input should return empty matrix"""
        result = build_speaker_crux_matrix([], [])

        assert result["speakers"] == []
        assert result["cruxLabels"] == []
        assert result["matrix"] == []

    def test_empty_cruxes(self):
        """Empty cruxes with speakers should return empty matrix"""
        speakers = ["1:Alice", "2:Bob"]

        result = build_speaker_crux_matrix([], speakers)

        assert result["speakers"] == []
        assert result["cruxLabels"] == []
        assert result["matrix"] == []

    def test_all_no_position(self):
        """All speakers with no positions"""
        subtopic_cruxes = [
            {
                "topic": "Topic",
                "subtopic": "Subtopic",
                "agree": [],
                "disagree": [],
            }
        ]
        speakers = ["1:Alice", "2:Bob"]

        result = build_speaker_crux_matrix(subtopic_cruxes, speakers)

        assert result["matrix"] == [
            ["no_position"],  # Alice
            ["no_position"],  # Bob
        ]

    def test_no_clear_position_field(self):
        """Speakers in no_clear_position list should be marked as 'no_position'"""
        subtopic_cruxes = [
            {
                "topic": "Topic",
                "subtopic": "Subtopic",
                "agree": ["1:Alice"],
                "disagree": ["3:Charlie"],
                "no_clear_position": ["2:Bob"],  # Bob mentioned topic but no clear stance
            }
        ]
        speakers = ["1:Alice", "2:Bob", "3:Charlie"]

        result = build_speaker_crux_matrix(subtopic_cruxes, speakers)

        assert result["matrix"] == [
            ["agree"],  # Alice
            ["no_position"],  # Bob explicitly has no clear position
            ["disagree"],  # Charlie
        ]


class TestCalculateTopicScores:
    """Test topic-level rollup calculations."""

    def test_single_topic_average(self):
        """Calculate average controversy across subtopics"""
        subtopics_by_topic = {
            "AI Safety": [
                {
                    "controversyScore": 0.8,
                    "agree": ["1:Alice"],
                    "disagree": ["2:Bob"],
                },
                {
                    "controversyScore": 0.6,
                    "agree": ["1:Alice"],
                    "disagree": ["3:Charlie"],
                },
            ]
        }

        result = calculate_topic_scores(subtopics_by_topic)

        assert len(result) == 1
        assert result[0]["topic"] == "AI Safety"
        assert result[0]["averageControversy"] == 0.7  # (0.8 + 0.6) / 2
        assert result[0]["subtopicCount"] == 2

    def test_unique_speaker_counting(self):
        """Count unique speakers across subtopics"""
        subtopics_by_topic = {
            "Topic": [
                {
                    "controversyScore": 0.5,
                    "agree": ["1:Alice", "2:Bob"],
                    "disagree": ["3:Charlie"],
                },
                {
                    "controversyScore": 0.6,
                    "agree": ["1:Alice"],  # Alice appears again
                    "disagree": ["4:Diana"],
                },
            ]
        }

        result = calculate_topic_scores(subtopics_by_topic)

        # Should count Alice, Bob, Charlie, Diana = 4 unique speakers
        assert result[0]["totalSpeakers"] == 4

    def test_multiple_topics(self):
        """Handle multiple topics"""
        subtopics_by_topic = {
            "AI Safety": [{"controversyScore": 0.8, "agree": ["1:Alice"], "disagree": []}],
            "Healthcare": [
                {"controversyScore": 0.6, "agree": [], "disagree": ["2:Bob"]}
            ],
        }

        result = calculate_topic_scores(subtopics_by_topic)

        assert len(result) == 2
        topics = {r["topic"] for r in result}
        assert topics == {"AI Safety", "Healthcare"}

    def test_empty_topics(self):
        """Skip topics with no cruxes"""
        subtopics_by_topic = {
            "Topic1": [{"controversyScore": 0.5, "agree": [], "disagree": []}],
            "Topic2": [],  # No cruxes
        }

        result = calculate_topic_scores(subtopics_by_topic)

        # Only Topic1 should be in results
        assert len(result) == 1
        assert result[0]["topic"] == "Topic1"

    def test_zero_controversy(self):
        """Handle subtopic with zero controversy"""
        subtopics_by_topic = {
            "Topic": [
                {"controversyScore": 0.0, "agree": ["1:Alice"], "disagree": []}
            ]
        }

        result = calculate_topic_scores(subtopics_by_topic)

        assert result[0]["averageControversy"] == 0.0
