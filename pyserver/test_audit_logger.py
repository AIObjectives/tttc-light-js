"""
Tests for ProcessingAuditLogger

This file contains unit tests for the audit logging functionality,
including crux speaker validation tracking and non-comment entry support.
"""

import pytest
from audit_logger import (
    ProcessingAuditLogger,
    AuditLogEntry,
)


class TestAuditLogEntry:
    """Test AuditLogEntry dataclass with entry_id and entry_type fields."""

    def test_comment_entry_with_entry_id(self):
        """Test creating a comment entry with entry_id as primary identifier."""
        entry = AuditLogEntry(
            entry_id="comment_123",
            step="claims_extraction",
            action="accepted",
            comment_id="comment_123",
            reason="Valid claim extracted"
        )

        assert entry.entry_id == "comment_123"
        assert entry.entry_type == "comment"  # Default
        assert entry.comment_id == "comment_123"

    def test_entry_type_defaults_to_comment(self):
        """Test that entry_type defaults to 'comment'."""
        entry = AuditLogEntry(
            entry_id="comment_456",
            step="sanitization_filter",
            action="rejected",
            comment_id="comment_456",
            reason="Contains PII"
        )

        assert entry.entry_type == "comment"

    def test_non_comment_entry_without_comment_id(self):
        """Test creating a non-comment entry (e.g., crux validation) without comment_id."""
        entry = AuditLogEntry(
            entry_id="crux_validation:Technology",
            step="crux_generation_validation",
            action="modified",
            entry_type="crux_validation",
            # comment_id intentionally omitted
            reason="Invalid speaker IDs detected: 2/5"
        )

        assert entry.entry_id == "crux_validation:Technology"
        assert entry.entry_type == "crux_validation"
        assert entry.comment_id is None


class TestCruxSpeakerValidation:
    """Test crux speaker validation logging functionality."""

    def test_log_crux_validation_with_recovery(self):
        """Test logging crux validation when processing recovers with valid IDs."""
        logger = ProcessingAuditLogger(report_id="test_report", input_comment_count=10)

        logger.log_crux_speaker_validation(
            subtopic="Technology/AI Ethics",
            total_speakers_from_llm=5,
            invalid_speakers=2,
            recovered=True
        )

        # Check entry was added
        assert len(logger.entries) == 1
        entry = logger.entries[0]

        # Verify entry fields
        assert entry.entry_id == "crux_validation:Technology/AI Ethics"
        assert entry.entry_type == "crux_validation"
        assert entry.comment_id is None  # Not a comment entry
        assert entry.step == "crux_generation_validation"
        assert entry.action == "modified"
        assert "Invalid speaker IDs detected: 2/5" in entry.reason
        assert entry.details["total_speakers_from_llm"] == 5
        assert entry.details["invalid_speakers"] == 2
        assert entry.details["valid_speakers"] == 3
        assert entry.details["recovered"] is True

        # Check summary counter
        assert logger.summary.crux_validation_recovered == 1
        assert logger.summary.crux_validation_failures == 0

    def test_log_crux_validation_without_recovery(self):
        """Test logging crux validation when processing fails (no valid IDs)."""
        logger = ProcessingAuditLogger(report_id="test_report", input_comment_count=10)

        logger.log_crux_speaker_validation(
            subtopic="Economy/Inflation",
            total_speakers_from_llm=3,
            invalid_speakers=3,
            recovered=False
        )

        # Check entry was added
        assert len(logger.entries) == 1
        entry = logger.entries[0]

        # Verify action is "rejected" for non-recovery
        assert entry.action == "rejected"
        assert entry.details["recovered"] is False

        # Check summary counter
        assert logger.summary.crux_validation_failures == 1
        assert logger.summary.crux_validation_recovered == 0

    def test_multiple_crux_validations(self):
        """Test logging multiple crux validations updates counters correctly."""
        logger = ProcessingAuditLogger(report_id="test_report", input_comment_count=10)

        # Log 2 recoveries and 1 failure
        logger.log_crux_speaker_validation("Topic A", 5, 1, recovered=True)
        logger.log_crux_speaker_validation("Topic B", 4, 2, recovered=True)
        logger.log_crux_speaker_validation("Topic C", 2, 2, recovered=False)

        assert len(logger.entries) == 3
        assert logger.summary.crux_validation_recovered == 2
        assert logger.summary.crux_validation_failures == 1

    def test_subtopic_with_special_characters(self):
        """Test logging crux validation with special characters in subtopic name."""
        logger = ProcessingAuditLogger(report_id="test_report", input_comment_count=10)

        # Test various special characters that might appear in subtopic names
        special_subtopics = [
            "Technology/AI:Ethics",  # Contains / and :
            "Health & Wellness",  # Contains &
            'Topic with "quotes"',  # Contains quotes
            "Unicode: café résumé",  # Contains unicode
            "Trailing space ",  # Trailing whitespace
        ]

        for subtopic in special_subtopics:
            logger.log_crux_speaker_validation(
                subtopic=subtopic,
                total_speakers_from_llm=5,
                invalid_speakers=1,
                recovered=True
            )

        # All should be logged successfully
        assert len(logger.entries) == len(special_subtopics)

        # Verify entry_ids are constructed correctly
        for i, subtopic in enumerate(special_subtopics):
            entry = logger.entries[i]
            assert entry.entry_id == f"crux_validation:{subtopic}"
            assert entry.comment_id is None  # Not a comment entry
            assert entry.details["subtopic"] == subtopic

        # Verify artifact serialization works with special characters
        artifact = logger.to_artifact()
        assert len(artifact["entries"]) == len(special_subtopics)


class TestSortingLogic:
    """Test that entry_id field is properly included in artifacts."""

    def test_entry_id_in_artifact(self):
        """Test that entry_id appears correctly in to_artifact() output."""
        logger = ProcessingAuditLogger(report_id="test_report", input_comment_count=3)

        # Add a regular comment entry
        logger.log_sanitization_filter(
            comment_id="comment_1",
            reason="Test filter",
            text="Test comment"
        )

        # Add a crux validation entry with explicit entry_id
        logger.log_crux_speaker_validation(
            subtopic="Test_Topic",
            total_speakers_from_llm=5,
            invalid_speakers=1,
            recovered=True
        )

        artifact = logger.to_artifact()

        # Check entries have correct entry_id values
        assert len(artifact["entries"]) == 2
        entry_ids = {entry["entryId"] for entry in artifact["entries"]}
        assert "comment_1" in entry_ids
        assert "crux_validation:Test_Topic" in entry_ids


class TestArtifactSerialization:
    """Test to_artifact() and from_artifact() with new fields."""

    def test_to_artifact_includes_new_fields(self):
        """Test that to_artifact() includes entry_id and entry_type in camelCase."""
        logger = ProcessingAuditLogger(report_id="test_report", input_comment_count=5)

        logger.log_crux_speaker_validation(
            subtopic="Test Topic",
            total_speakers_from_llm=10,
            invalid_speakers=3,
            recovered=True
        )

        artifact = logger.to_artifact()

        # Check entry has new fields in camelCase
        assert len(artifact["entries"]) == 1
        entry = artifact["entries"][0]
        assert "entryId" in entry
        assert "entryType" in entry
        assert entry["entryId"] == "crux_validation:Test Topic"
        assert entry["entryType"] == "crux_validation"
        assert "commentId" not in entry  # Not included for non-comment entries

        # Check summary has new counters
        summary = artifact["summary"]
        assert "cruxValidationRecovered" in summary
        assert "cruxValidationFailures" in summary
        assert summary["cruxValidationRecovered"] == 1
        assert summary["cruxValidationFailures"] == 0

    def test_to_artifact_includes_comment_id_for_comment_entries(self):
        """Test that commentId is included in artifact for comment entries."""
        logger = ProcessingAuditLogger(report_id="test_report", input_comment_count=5)

        logger.log_claims_extraction_success(
            comment_id="comment_123",
            num_claims=2,
            text="Test comment"
        )

        artifact = logger.to_artifact()

        assert len(artifact["entries"]) == 1
        entry = artifact["entries"][0]
        assert entry["entryId"] == "comment_123"
        assert entry["entryType"] == "comment"
        assert entry["commentId"] == "comment_123"

    def test_from_artifact_restores_new_fields(self):
        """Test that from_artifact() correctly restores entry_id and entry_type."""
        artifact = {
            "reportId": "test_report",
            "inputCommentCount": 5,
            "entries": [
                {
                    "entryId": "crux_validation:Topic",
                    "entryType": "crux_validation",
                    "step": "crux_generation_validation",
                    "action": "modified",
                    "reason": "Test",
                    "details": {}
                    # Note: No commentId for non-comment entries
                }
            ],
            "summary": {
                "rejectedBySanitization": 0,
                "rejectedByMeaningfulness": 0,
                "rejectedByClaimsExtraction": 0,
                "deduplicated": 0,
                "accepted": 5,
                "cruxValidationRecovered": 1,
                "cruxValidationFailures": 0
            }
        }

        logger = ProcessingAuditLogger.from_artifact(artifact)

        # Check entry fields restored
        assert len(logger.entries) == 1
        entry = logger.entries[0]
        assert entry.entry_id == "crux_validation:Topic"
        assert entry.entry_type == "crux_validation"
        assert entry.comment_id is None  # Not a comment entry

        # Check summary restored
        assert logger.summary.crux_validation_recovered == 1
        assert logger.summary.crux_validation_failures == 0
        assert logger.summary.accepted == 5

    def test_from_artifact_backward_compatibility(self):
        """Test that from_artifact() handles old artifacts without new fields."""
        artifact = {
            "reportId": "old_report",
            "inputCommentCount": 10,
            "entries": [
                {
                    "commentId": "comment_123",
                    "step": "claims_extraction",
                    "action": "accepted",
                    "reason": "Valid claim",
                    "details": {}
                    # Note: No entryId or entryType fields
                }
            ],
            "summary": {
                "rejectedBySanitization": 2,
                "rejectedByMeaningfulness": 1,
                "rejectedByClaimsExtraction": 0,
                "deduplicated": 1,
                "accepted": 6
                # Note: No crux validation counters
            }
        }

        logger = ProcessingAuditLogger.from_artifact(artifact)

        # Entry should use comment_id as entry_id and default to "comment" type
        assert len(logger.entries) == 1
        entry = logger.entries[0]
        assert entry.entry_id == "comment_123"
        assert entry.entry_type == "comment"
        assert entry.comment_id == "comment_123"  # Restored for comment entries

        # Summary should have crux counters defaulted to 0
        assert logger.summary.crux_validation_recovered == 0
        assert logger.summary.crux_validation_failures == 0


class TestSummaryCounters:
    """Test that crux validation metrics are tracked in summary counters."""

    def test_summary_includes_crux_validation_counters(self):
        """Test that crux validation stats are tracked in summary counters."""
        logger = ProcessingAuditLogger(report_id="test_report", input_comment_count=100)

        # Add some crux validations
        logger.log_crux_speaker_validation("Topic 1", 10, 2, recovered=True)
        logger.log_crux_speaker_validation("Topic 2", 8, 8, recovered=False)

        # Add some regular comment processing
        logger.log_claims_extraction_success(
            comment_id="comment_1",
            num_claims=2,
            text="Valid comment 1"
        )
        logger.log_claims_extraction_success(
            comment_id="comment_2",
            num_claims=1,
            text="Valid comment 2"
        )

        # Check summary counters
        assert logger.summary.crux_validation_recovered == 1
        assert logger.summary.crux_validation_failures == 1
        assert logger.summary.accepted == 2

        # Check artifact includes counters
        artifact = logger.to_artifact()
        assert artifact["summary"]["cruxValidationRecovered"] == 1
        assert artifact["summary"]["cruxValidationFailures"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
