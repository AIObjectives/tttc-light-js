"""
Audit logging for comment processing pipeline.

Tracks all decisions made during comment processing for transparency,
debugging, and quality assurance. Logs are stored as JSON artifacts
alongside reports in GCS.

Privacy considerations:
- Comment text is only included in memory during processing
- Only comment IDs are stored in the final audit log artifact
- Audit logs are stored with same access controls as reports
"""

from datetime import datetime
from typing import Dict, List, Literal, Optional, Any
from dataclasses import dataclass, field, asdict
import json

StepType = Literal[
    "input",
    "sanitization_filter",
    "meaningfulness_filter",
    "claims_extraction",
    "deduplication"
]

ActionType = Literal["received", "accepted", "rejected", "modified", "deduplicated"]


@dataclass
class LLMMetadata:
    """Metadata about LLM processing for reproducibility"""
    model: str
    prompt_version: Optional[str] = None
    temperature: Optional[float] = None
    response_hash: Optional[str] = None  # Hash of LLM response for non-determinism detection


@dataclass
class AuditLogEntry:
    """Single entry in the audit log"""
    comment_id: str
    step: StepType
    action: ActionType
    reason: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    # Additional tracking fields
    interview: Optional[str] = None  # Speaker/interview name from CSV
    text_preview: Optional[str] = None  # First 200 chars of comment for human readability
    comment_length: Optional[int] = None  # Length of comment text
    claims_extracted: Optional[int] = None  # Number of claims extracted from this comment
    claim_ids: Optional[List[str]] = None  # IDs of claims generated from this comment
    topic_assignments: Optional[List[str]] = None  # Topics/subtopics this claim was assigned to
    deduplicated_with: Optional[List[str]] = None  # IDs of claims this was merged with
    llm_model: Optional[str] = None  # Model used for this processing step (DEPRECATED: use llm_metadata)
    llm_metadata: Optional[Dict[str, Any]] = None  # Structured LLM metadata for reproducibility
    primary_claim_id: Optional[str] = None  # For deduplication: the surviving claim ID
    merged_claim_ids: Optional[List[str]] = None  # For deduplication: all claims merged into primary
    # Note: comment_text is intentionally NOT stored in the artifact


@dataclass
class AuditLogSummary:
    """Summary statistics for the audit log"""
    rejected_by_sanitization: int = 0
    rejected_by_meaningfulness: int = 0
    rejected_by_claims_extraction: int = 0
    deduplicated: int = 0
    accepted: int = 0


class ProcessingAuditLogger:
    """
    Tracks processing decisions for a single report.

    Usage:
        audit = ProcessingAuditLogger(report_id="ABC123")

        # Track input comments
        for comment in comments:
            audit.log_input(comment.id, text=comment.text)

        # Track filtering
        if not is_safe:
            audit.log_sanitization_filter(comment.id, "Contains unsafe content", text=comment.text)

        # Track extraction results
        if len(claims) == 0:
            audit.log_claims_extraction_empty(comment.id, text=comment.text)
        else:
            audit.log_claims_extraction_success(comment.id, num_claims=len(claims), text=comment.text)

        # Get final artifact (without PII)
        audit_artifact = audit.to_artifact()
    """

    @staticmethod
    def _create_text_preview(text: Optional[str], max_length: int = 200) -> Optional[str]:
        """Create a truncated preview of text for human readability"""
        if not text:
            return None
        if len(text) <= max_length:
            return text
        return text[:max_length] + "..."

    def __init__(self, report_id: str, input_comment_count: int = 0, model_name: str = "gpt-4o-mini"):
        self.report_id = report_id
        self.created_at = datetime.utcnow().isoformat()
        self.input_comment_count = input_comment_count
        self.model_name = model_name
        self.entries: List[AuditLogEntry] = []
        self.summary = AuditLogSummary()

    @classmethod
    def from_artifact(cls, artifact: Dict[str, Any]) -> 'ProcessingAuditLogger':
        """Restore ProcessingAuditLogger from artifact dict (expects camelCase from Redis)"""
        # Version field for schema migrations (default to 1.0 for backward compatibility)
        version = artifact.get("version", "1.0")

        report_id = artifact.get("reportId", "unknown")
        input_count = artifact.get("inputCommentCount", 0)
        model_name = artifact.get("modelName", "gpt-4o-mini")

        logger = cls(
            report_id=report_id,
            input_comment_count=input_count,
            model_name=model_name
        )
        logger.created_at = artifact.get("createdAt", datetime.utcnow().isoformat())

        # Restore entries - camelCase format from Redis
        for entry_dict in artifact.get("entries", []):
            logger.entries.append(AuditLogEntry(
                comment_id=entry_dict["commentId"],
                step=entry_dict["step"],
                action=entry_dict["action"],
                reason=entry_dict.get("reason"),
                details=entry_dict.get("details"),
                timestamp=entry_dict.get("timestamp", datetime.utcnow().isoformat()),
                interview=entry_dict.get("interview"),
                text_preview=entry_dict.get("textPreview"),
                comment_length=entry_dict.get("commentLength"),
                claims_extracted=entry_dict.get("claimsExtracted"),
                claim_ids=entry_dict.get("claimIds"),
                topic_assignments=entry_dict.get("topicAssignments"),
                deduplicated_with=entry_dict.get("deduplicatedWith"),
                llm_model=entry_dict.get("llmModel"),
                llm_metadata=entry_dict.get("llmMetadata"),
                primary_claim_id=entry_dict.get("primaryClaimId"),
                merged_claim_ids=entry_dict.get("mergedClaimIds")
            ))

        # Restore summary - camelCase format from Redis
        summary_dict = artifact.get("summary", {})
        logger.summary = AuditLogSummary(
            rejected_by_sanitization=summary_dict.get("rejectedBySanitization", 0),
            rejected_by_meaningfulness=summary_dict.get("rejectedByMeaningfulness", 0),
            rejected_by_claims_extraction=summary_dict.get("rejectedByClaimsExtraction", 0),
            deduplicated=summary_dict.get("deduplicated", 0),
            accepted=summary_dict.get("accepted", 0)
        )

        return logger

    def _add_entry(self, entry: AuditLogEntry):
        """Add an entry to the log"""
        self.entries.append(entry)

    def log_input(self, comment_id: str, interview: Optional[str] = None, comment_length: Optional[int] = None, text: Optional[str] = None):
        """Log that a comment was received as input"""
        self._add_entry(AuditLogEntry(
            comment_id=comment_id,
            step="input",
            action="received",
            interview=interview,
            text_preview=self._create_text_preview(text),
            comment_length=comment_length
        ))

    def log_sanitization_filter(self, comment_id: str, reason: str, text: Optional[str] = None):
        """Log that a comment was rejected by sanitization

        Note: Does NOT include text preview for security - we don't want to store
        potentially harmful content that was filtered out.
        """
        self._add_entry(AuditLogEntry(
            comment_id=comment_id,
            step="sanitization_filter",
            action="rejected",
            reason=reason
            # Intentionally omitting text_preview for security
        ))
        self.summary.rejected_by_sanitization += 1

    def log_sanitization_modified(self, comment_id: str, details: Optional[Dict] = None, text: Optional[str] = None):
        """Log that a comment was sanitized/modified"""
        self._add_entry(AuditLogEntry(
            comment_id=comment_id,
            step="sanitization_filter",
            action="modified",
            reason="Content sanitized",
            details=details,
            text_preview=self._create_text_preview(text)
        ))

    def log_meaningfulness_filter(self, comment_id: str, reason: str, text: Optional[str] = None):
        """Log that a comment was rejected as not meaningful"""
        self._add_entry(AuditLogEntry(
            comment_id=comment_id,
            step="meaningfulness_filter",
            action="rejected",
            reason=reason,
            text_preview=self._create_text_preview(text)
        ))
        self.summary.rejected_by_meaningfulness += 1

    def log_claims_extraction_empty(
        self,
        comment_id: str,
        llm_metadata: Optional[Dict[str, Any]] = None,
        interview: Optional[str] = None,
        text: Optional[str] = None
    ):
        """Log that no claims were extracted from a comment"""
        self._add_entry(AuditLogEntry(
            comment_id=comment_id,
            step="claims_extraction",
            action="rejected",
            reason="No claims extracted",
            claims_extracted=0,
            llm_metadata=llm_metadata,
            interview=interview,
            text_preview=self._create_text_preview(text)
        ))
        self.summary.rejected_by_claims_extraction += 1

    def log_claims_extraction_success(
        self,
        comment_id: str,
        num_claims: int,
        claim_ids: Optional[List[str]] = None,
        details: Optional[Dict] = None,
        llm_metadata: Optional[Dict[str, Any]] = None,
        interview: Optional[str] = None,
        topic_assignments: Optional[List[str]] = None,
        text: Optional[str] = None
    ):
        """Log successful claims extraction with claim IDs for traceability"""
        self._add_entry(AuditLogEntry(
            comment_id=comment_id,
            step="claims_extraction",
            action="accepted",
            reason=f"Extracted {num_claims} claim(s)",
            details=details,
            claims_extracted=num_claims,
            claim_ids=claim_ids,
            llm_metadata=llm_metadata,
            interview=interview,
            topic_assignments=topic_assignments,
            text_preview=self._create_text_preview(text)
        ))
        self.summary.accepted += 1

    def log_deduplication(
        self,
        primary_claim_id: str,
        merged_claim_ids: List[str],
        details: Optional[Dict] = None,
        text: Optional[str] = None
    ):
        """
        Log that claims were deduplicated together.

        Args:
            primary_claim_id: The surviving claim ID (commentId of the primary claim)
            merged_claim_ids: List of claim IDs (commentIds) that were merged into primary
            details: Additional context about the merge decision
            text: The claim text for the primary claim (for text preview)
        """
        # Use the first merged claim's ID as the comment_id for the entry
        comment_id = merged_claim_ids[0] if merged_claim_ids else primary_claim_id

        self._add_entry(AuditLogEntry(
            comment_id=comment_id,
            step="deduplication",
            action="deduplicated",
            reason=f"Merged {len(merged_claim_ids)} claim(s) into primary claim",
            primary_claim_id=primary_claim_id,
            merged_claim_ids=merged_claim_ids,
            details=details,
            text_preview=self._create_text_preview(text)
        ))
        self.summary.deduplicated += len(merged_claim_ids)

    def get_final_quote_count(self) -> int:
        """Calculate final quote count from audit log"""
        # Count all claims that made it through (accepted - deduplicated)
        return self.summary.accepted - self.summary.deduplicated

    def to_artifact(self) -> Dict[str, Any]:
        """
        Convert to JSON artifact for storage.

        IMPORTANT: This removes all comment text for privacy.
        Only stores comment IDs and processing decisions.

        Uses camelCase to match TypeScript conventions throughout the system.
        Entries are sorted by pipeline step order (input → extraction → deduplication),
        then by comment_id within each step for easy tracing.
        """
        # Define step order for sorting (chronological pipeline order)
        step_order = {
            "input": 1,
            "sanitization_filter": 2,
            "meaningfulness_filter": 3,
            "claims_extraction": 4,
            "deduplication": 5,
        }

        # Sort entries by step order, then comment_id, then timestamp
        sorted_entries = sorted(
            self.entries,
            key=lambda e: (
                step_order.get(e.step, 999),  # Unknown steps go to end
                int(e.comment_id) if e.comment_id.isdigit() else float('inf'),
                e.timestamp
            )
        )

        # Calculate percentages and human-readable stats
        total_rejected = (self.summary.rejected_by_sanitization +
                         self.summary.rejected_by_meaningfulness +
                         self.summary.rejected_by_claims_extraction)
        acceptance_rate = (self.summary.accepted / self.input_comment_count * 100) if self.input_comment_count > 0 else 0
        rejection_rate = (total_rejected / self.input_comment_count * 100) if self.input_comment_count > 0 else 0

        claims_before_dedup = self.summary.accepted
        claims_after_dedup = self.get_final_quote_count()
        dedup_rate = (self.summary.deduplicated / claims_before_dedup * 100) if claims_before_dedup > 0 else 0

        return {
            "version": "1.0",
            "reportId": self.report_id,
            "createdAt": self.created_at,
            "inputCommentCount": self.input_comment_count,
            "finalQuoteCount": self.get_final_quote_count(),
            "modelName": self.model_name,
            "entries": [
                {
                    k: v
                    for k, v in {
                        "commentId": e.comment_id,
                        "step": e.step,
                        "action": e.action,
                        "reason": e.reason,
                        "details": e.details,
                        "timestamp": e.timestamp,
                        "interview": e.interview,
                        "textPreview": e.text_preview,
                        "commentLength": e.comment_length,
                        "claimsExtracted": e.claims_extracted,
                        "claimIds": e.claim_ids,
                        "topicAssignments": e.topic_assignments,
                        "deduplicatedWith": e.deduplicated_with,
                        "primaryClaimId": e.primary_claim_id,
                        "mergedClaimIds": e.merged_claim_ids,
                    }.items()
                    if v is not None  # Omit None values to match TypeScript .optional()
                }
                for e in sorted_entries
            ],
            "summary": {
                "rejectedBySanitization": self.summary.rejected_by_sanitization,
                "rejectedByMeaningfulness": self.summary.rejected_by_meaningfulness,
                "rejectedByClaimsExtraction": self.summary.rejected_by_claims_extraction,
                "deduplicated": self.summary.deduplicated,
                "accepted": self.summary.accepted,
                "humanReadable": {
                    "inputComments": self.input_comment_count,
                    "acceptedComments": f"{self.summary.accepted} of {self.input_comment_count} ({acceptance_rate:.1f}%)",
                    "rejectedComments": f"{total_rejected} of {self.input_comment_count} ({rejection_rate:.1f}%)",
                    "deduplication": f"{self.summary.deduplicated} claims merged ({dedup_rate:.1f}% reduction)",
                    "finalQuotes": claims_after_dedup
                }
            }
        }

    def to_json(self) -> str:
        """Convert to JSON string for storage"""
        return json.dumps(self.to_artifact(), indent=2)


# Global audit logger instance (set per request)
_current_audit_logger: Optional[ProcessingAuditLogger] = None


def set_audit_logger(logger: ProcessingAuditLogger):
    """Set the current audit logger for this request"""
    global _current_audit_logger
    _current_audit_logger = logger


def get_audit_logger() -> Optional[ProcessingAuditLogger]:
    """Get the current audit logger"""
    return _current_audit_logger


def clear_audit_logger():
    """Clear the current audit logger"""
    global _current_audit_logger
    _current_audit_logger = None
