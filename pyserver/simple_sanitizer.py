#!/usr/bin/env python

"""
Minimal prompt sanitization focused on specific risks not covered by OpenAI's safety systems.
OpenAI already handles most content safety - we focus on prompt injection and basic validation.
Also includes PII filtering to protect user privacy in the final report outputs.
"""

import re
import logging
import os
from typing import Tuple

logger = logging.getLogger(__name__)

# Reasonable limits
MAX_COMMENT_LENGTH = 10000  # Generous but prevents abuse
MAX_PROMPT_LENGTH = 100000  # OpenAI has its own limits anyway

# Simple configuration
ENABLE_PII_FILTERING = os.getenv("ENABLE_PII_FILTERING", "true").lower() == "true"

# Focus on prompt injection patterns that could manipulate system behavior
# OpenAI handles content safety, we handle prompt structure attacks
INJECTION_PATTERNS = [
    r'(?i)\bignore\s+(all\s+)?(previous|above|earlier)\s+(instructions?|prompts?)',
    r'(?i)\b(system|assistant|ai)\s*:\s*',
    r'(?i)\byou\s+are\s+(now|actually)\s+',
    r'(?i)\bact\s+as\s+(if\s+)?you\s+(are|were)\s+',
    r'(?i)\bpretend\s+(to\s+be|you\s+are)\s+',
]

# PII patterns for protecting user privacy in final reports
# Not for OpenAI safety - for report output privacy
PII_PATTERNS = [
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]'),  # Email addresses
    (r'\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b', '[PHONE]'),  # Phone numbers
    (r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]'),  # SSN format
    (r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b', '[CARD]'),  # Credit card format
]

def filter_pii(text: str) -> str:
    """
    Filter PII from text to protect user privacy in final reports.
    This is not for OpenAI safety - it's for report output privacy.
    """
    if not ENABLE_PII_FILTERING:
        return text
    
    filtered_text = text
    for pattern, replacement in PII_PATTERNS:
        filtered_text = re.sub(pattern, replacement, filtered_text)
    
    return filtered_text

def basic_sanitize(text: str, context: str = "", filter_pii_flag: bool = True) -> Tuple[str, bool]:
    """
    Minimal sanitization focusing on prompt injection and basic validation.
    Optionally filters PII for report output privacy.
    
    Args:
        text: Input text to sanitize
        context: Context for logging
        filter_pii_flag: Whether to apply PII filtering (default True)
        
    Returns:
        Tuple of (sanitized_text, is_safe)
    """
    if not isinstance(text, str):
        return "", False
    
    # Basic length check - reject oversized content (defense-in-depth)
    if len(text) > MAX_COMMENT_LENGTH:
        logger.error(f"Oversized input rejected in {context}: {len(text)} chars - client validation bypassed")
        return "", False
    
    # Empty or too short
    if len(text.strip()) < 3:
        return "", False
    
    # Check for basic prompt injection attempts
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text):
            logger.warning(f"Potential prompt injection in {context}: {pattern}")
            return "", False
    
    # Apply PII filtering if requested
    if filter_pii_flag:
        text = filter_pii(text)
    
    return text.strip(), True

def sanitize_prompt_length(prompt: str) -> str:
    """Simple prompt length limiting."""
    if len(prompt) > MAX_PROMPT_LENGTH:
        logger.warning(f"Truncating oversized prompt: {len(prompt)} chars")
        return prompt[:MAX_PROMPT_LENGTH]
    return prompt

def sanitize_for_output(data):
    """
    Sanitize a data structure for final output by filtering PII from text fields.
    Use this on the final report JSON before returning to client.
    
    Args:
        data: Dictionary containing report data
        
    Returns:
        Dictionary with PII filtered from text content
    """
    if not ENABLE_PII_FILTERING:
        return data
    
    def filter_dict_values(obj):
        if isinstance(obj, dict):
            return {k: filter_dict_values(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [filter_dict_values(item) for item in obj]
        elif isinstance(obj, str):
            return filter_pii(obj)
        else:
            return obj
    
    return filter_dict_values(data)