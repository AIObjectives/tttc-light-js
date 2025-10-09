#!/usr/bin/env python

########################################
# T3C Pyserver: LLM Pipeline in Python #
# --------------------------------------#
"""A minimal FastAPI Python server calling the T3C LLM pipeline.

Each pipeline call assumes the client has already included
any user edits of the LLM configuration, including the model
name to use, the system prompt, and the specific pipeline step prompts.

Currently only supports OpenAI (Anthropic soon!!!)
For local testing, load these from a config.py file
"""

import json
from json import JSONDecodeError
import logging
import math
import os
import sys
from pathlib import Path
from typing import List, Dict
from collections import defaultdict
import time
import asyncio
from threading import Lock
import psutil

import wandb
from dotenv import load_dotenv
from fastapi import FastAPI, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from structured_schemas import create_claims_schema_from_taxonomy, create_taxonomy_prompt_with_constraints



# Add the current directory to path for imports
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))
import config
from utils import cute_print, full_speaker_map, token_cost, topic_desc_map, comment_is_meaningful
from simple_sanitizer import basic_sanitize, sanitize_prompt_length, sanitize_for_output

load_dotenv()

# Configure logging for CORS security monitoring and API call tracking
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_report_logger(user_id: str = None, report_id: str = None):
    """Get a logger with report context for better debugging across concurrent reports"""
    context_parts = []
    if user_id:
        context_parts.append(f"user_{user_id}")
    if report_id:
        context_parts.append(f"report_{report_id}")

    if context_parts:
        return logger.getChild(".".join(context_parts))
    return logger

# Global API call tracker with thread safety
class APICallTracker:
    def __init__(self):
        self.lock = Lock()
        self.reset()
    
    def reset(self):
        with self.lock:
            self.calls = defaultdict(list)
            self.call_counts = defaultdict(int)
            self.total_calls = 0
            self.start_time = time.time()
    
    def track_call(self, step: str, context: Dict):
        """Track an API call with context information"""
        # Capture data under lock first
        should_log = False
        log_data = None
        
        with self.lock:
            self.total_calls += 1
            self.call_counts[step] += 1
            self.calls[step].append({
                'timestamp': time.time(),
                'context': context,
                'call_number': self.total_calls
            })
            
            # Check if we should log (every 50 calls) and capture data
            if self.total_calls % 50 == 0:
                should_log = True
                elapsed = time.time() - self.start_time
                log_data = {
                    'total_calls': self.total_calls,
                    'elapsed': elapsed,
                    'call_counts': dict(self.call_counts)  # Copy to avoid race conditions
                }
        
        # Perform I/O operations outside the lock
        if should_log and log_data:
            logger.info(f"API CALL SUMMARY: Total={log_data['total_calls']}, Elapsed={log_data['elapsed']:.1f}s")
            for step_name, count in log_data['call_counts'].items():
                logger.info(f"  {step_name}: {count} calls")
    
    def get_summary(self):
        with self.lock:
            elapsed = time.time() - self.start_time if hasattr(self, 'start_time') else 0
            return {
                'total_calls': self.total_calls,
                'elapsed_seconds': elapsed,
                'calls_per_step': dict(self.call_counts),
                'average_call_rate': self.total_calls / elapsed if elapsed > 0 else 0
            }

api_tracker = APICallTracker()

# Concurrency configuration for rate limiting
MAX_CONCURRENCY = int(os.getenv("PYSERVER_MAX_CONCURRENCY", "6"))  # Default to 6 concurrent requests
ENABLE_CONCURRENT_PROCESSING = os.getenv("ENABLE_CONCURRENT_PROCESSING", "true").lower() == "true"  # Enabled by default
concurrency_semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

# API rate limiting backpressure - reduced for better performance
API_RATE_LIMIT_DELAY = float(os.getenv("API_RATE_LIMIT_DELAY", "0.05"))  # 50ms between API calls

# Request-scoped processing tracking with thread safety
class ProcessingTracker:
    def __init__(self):
        self.lock = Lock()
        self.active_requests = 0
        self.request_stats = {}  # request_id -> stats
    
    def start_request(self, request_id: str, total_comments: int):
        with self.lock:
            self.active_requests += 1
            self.request_stats[request_id] = {
                "total_comments": total_comments,
                "completed_comments": 0,
                "start_time": time.time(),
                "last_progress_update": time.time()
            }
    
    def update_progress(self, request_id: str, completed_count: int = 1):
        with self.lock:
            if request_id in self.request_stats:
                self.request_stats[request_id]["completed_comments"] += completed_count
                self.request_stats[request_id]["last_progress_update"] = time.time()
    
    def end_request(self, request_id: str):
        with self.lock:
            self.active_requests = max(0, self.active_requests - 1)
            if request_id in self.request_stats:
                del self.request_stats[request_id]
    
    def cleanup_stale_requests(self, max_age_seconds: int = 3600):
        """Clean up request stats that are older than max_age_seconds (default 1 hour)"""
        current_time = time.time()
        stale_requests = []
        
        with self.lock:
            for request_id, stats in self.request_stats.items():
                if current_time - stats["start_time"] > max_age_seconds:
                    stale_requests.append(request_id)
            
            # Remove stale requests
            for request_id in stale_requests:
                del self.request_stats[request_id]
                self.active_requests = max(0, self.active_requests - 1)
        
        if stale_requests:
            logger.warning(f"Cleaned up {len(stale_requests)} stale request entries older than {max_age_seconds}s")
    
    def get_summary(self):
        with self.lock:
            total_comments = sum(stats["total_comments"] for stats in self.request_stats.values())
            completed_comments = sum(stats["completed_comments"] for stats in self.request_stats.values())
            return {
                "active_requests": self.active_requests,
                "total_comments": total_comments,
                "completed_comments": completed_comments,
                "progress_percentage": (completed_comments / total_comments * 100) if total_comments > 0 else 0
            }

processing_tracker = ProcessingTracker()

app = FastAPI()

# CORS Security Configuration Constants
PREFLIGHT_CACHE_SECONDS = 24 * 60 * 60  # 24 hours

# CORS Security Configuration  
# Prevents unauthorized cross-origin requests to FastAPI endpoints
# Only Express server should call Python server - Next.js client calls Express server
def get_allowed_origins():
    """
    Get allowed origins for CORS configuration.
    Requires ALLOWED_ORIGINS to be explicitly set in all environments for security.
    All origins including Express server must be explicitly configured.
    """
    allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
    
    # Require ALLOWED_ORIGINS in all environments (matching Express server behavior)
    if not allowed_origins_env or allowed_origins_env.strip() == "":
        raise ValueError(
            "ALLOWED_ORIGINS environment variable is required in all environments. "
            "For development, set: ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000 "
            "(Express server origin must be included for service communication)"
        )
    
    # Parse comma-separated origins
    origins = [
        origin.strip() 
        for origin in allowed_origins_env.split(",") 
        if origin.strip()
    ]
    
    # Validate at least one origin is specified
    if not origins:
        raise ValueError("ALLOWED_ORIGINS must contain at least one valid origin")
    
    return origins

allowed_origins = get_allowed_origins()

# Log CORS configuration on startup for security monitoring
logger.info(
    "CORS config: env=%s, origins=%s",
    os.getenv("NODE_ENV", "development"),
    allowed_origins,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "X-OpenAI-API-Key"  # Allow custom headers for API keys
    ],
    max_age=PREFLIGHT_CACHE_SECONDS  # Cache preflight for 24 hours
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Add HSTS header in production
    if os.getenv('NODE_ENV') == 'production':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    
    return response

class Comment(BaseModel):
    id: str
    text: str
    speaker: str


class CommentList(BaseModel):
    comments: List[Comment]


class LLMConfig(BaseModel):
    model_name: str
    system_prompt: str
    user_prompt: str


class CommentsLLMConfig(BaseModel):
    comments: List[Comment]
    llm: LLMConfig


class CommentTopicTree(BaseModel):
    comments: List[Comment]
    llm: LLMConfig
    tree: dict


class ClaimTreeLLMConfig(BaseModel):
    tree: dict
    llm: LLMConfig
    sort: str


class CruxesLLMConfig(BaseModel):
    crux_tree: dict
    llm: LLMConfig
    topics: list
    top_k: int

@app.get("/")
def read_root():
    # TODO: setup/relevant defaults?
    return {"Hello": "World"}

@app.get("/health/processing")
async def processing_health_check():
    """Health check endpoint to monitor concurrent processing progress"""
    summary = processing_tracker.get_summary()
    
    # Get memory usage
    process = psutil.Process()
    memory_info = process.memory_info()
    memory_percent = process.memory_percent()
    memory_mb = round(memory_info.rss / 1024 / 1024, 1)
    
    # Check memory limits (fail health check if > 80% memory or > 1.6GB)
    MAX_MEMORY_MB = 1600  # 1.6GB limit (80% of 2GB Cloud Run limit)
    health_status = "healthy"
    if memory_percent > 80 or memory_mb > MAX_MEMORY_MB:
        health_status = "memory_warning"
    
    return {
        "status": "processing" if summary["active_requests"] > 0 else "idle",
        "health": health_status,
        "active_requests": summary["active_requests"],
        "progress": {
            "total_comments": summary["total_comments"],
            "completed_comments": summary["completed_comments"],
            "progress_percentage": summary["progress_percentage"]
        },
        "performance": {
            "concurrency_enabled": ENABLE_CONCURRENT_PROCESSING,
            "concurrency_limit": MAX_CONCURRENCY,
            "memory_usage_mb": memory_mb,
            "memory_percent": round(memory_percent, 1),
            "memory_limit_mb": MAX_MEMORY_MB
        }
    }

###################################
# Step 1: Comments to Topic Tree  #
# ---------------------------------#
@app.post("/topic_tree")
def comments_to_tree(
    req: CommentsLLMConfig,
    x_openai_api_key: str = Header(..., alias="X-OpenAI-API-Key"),
    x_report_id: str = Header(None, alias="X-Report-ID"),
    x_user_id: str = Header(None, alias="X-User-ID"),
    log_to_wandb: str = config.WANDB_GROUP_LOG_NAME,
    dry_run=False,
) -> dict:
    """Given the full list of comments, return a corresponding taxonomy of relevant topics and their
    subtopics, with a short description for each.

    Input format:
    - CommentLLMConfig object: JSON/dictionary with the following fields:
      - comments: a list of Comment (each has a field, "text", for the raw text of the comment, and an id)
      - llm: a dictionary of the LLM configuration:
        - model_name: a string of the name of the LLM to call ("gpt-4o-mini", "gpt-4-turbo-preview")
        - system_prompt: a string of the system prompt
        - user_prompt: a string of the user prompt to convert the raw comments into the
                             taxonomy/topic tree
    Example:
    {
      "llm": {
          "model_name": "gpt-4o-mini",
          "system_prompt": "\n\tYou are a professional research assistant.",
          "topic_tree_prompt": "\nI will give you a list of comments."
      },
      "comments": [
          {
              "id": "c1",
              "text": "I love cats"
          },
          {
              "id": "c2",
              "text": "dogs are great"
          },
          {
              "id": "c3",
              "text": "I'm not sure about birds"
          }
      ]
    }

    Output format:
    - data : the tree as a dictionary
      - taxonomy : a key mapping to a list of topics, where each topic has
        - topicName: a string of the short topic title
        - topicShortDescription: a string of a short description of the topic
        - subtopics: a list of the subtopics of this main/parent topic, where each subtopic has
          - subtopicName: a string of the short subtopic title
          - subtopicShortDescription: a string of a short description of the subtopic
    - usage: a dictionary of token counts
      - completion_tokens
      - prompt_tokens
      - total_tokens

    Example output:
    {
      "data": {
          "taxonomy": [
              {
                  "topicName": "Pets",
                  "topicShortDescription": "General opinions about common household pets.",
                  "subtopics": [
                      {
                          "subtopicName": "Cats",
                          "subtopicShortDescription": "Positive sentiments towards cats as pets."
                      },
                      {
                          "subtopicName": "Dogs",
                          "subtopicShortDescription": "Positive sentiments towards dogs as pets."
                      },
                      {
                          "subtopicName": "Birds",
                          "subtopicShortDescription": "Uncertainty or mixed feelings about birds as pets."
                      }
                  ]
              }
          ]
      },
      "usage": {
          "completion_tokens": 131,
          "prompt_tokens": 224,
          "total_tokens": 355
      }
    }
    """
    # skip calling an LLM
    if dry_run or config.DRY_RUN:
        print("dry_run topic tree")
        return config.MOCK_RESPONSE["topic_tree"]

    # Get report-specific logger
    report_logger = get_report_logger(x_user_id, x_report_id)

    # Reset tracker for new report processing
    api_tracker.reset()
    report_logger.info(f"Starting topic_tree processing with {len(req.comments)} comments")
    
    # Basic sanitization - just check for prompt injection and length
    client = OpenAI(api_key=x_openai_api_key)

    # append comments to prompt with basic sanitization
    full_prompt = req.llm.user_prompt
    for comment in req.comments:
        # Basic sanitization check
        sanitized_text, is_safe = basic_sanitize(comment.text, "topic_tree_comment")
        if is_safe and comment_is_meaningful(sanitized_text):
            full_prompt += "\n" + sanitized_text
        elif not is_safe:
            report_logger.warning(f"Rejecting unsafe comment in topic_tree")
    
    # Basic prompt length check
    full_prompt = sanitize_prompt_length(full_prompt)
    
    # Track API call
    api_tracker.track_call('topic_tree', {
        'num_comments': len(req.comments),
        'prompt_length': len(full_prompt),
        'model': req.llm.model_name
    })
    report_logger.info(f"API Call #{api_tracker.total_calls}: topic_tree (comments={len(req.comments)})")

    response = client.chat.completions.create(
        model=req.llm.model_name,
        messages=[
            {"role": "system", "content": req.llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    try:
        tree = json.loads(response.choices[0].message.content)
    except Exception:
        print("Step 1: no topic tree: ", response)
        tree = {}
    usage = response.usage
    # compute LLM costs for this step's tokens
    s1_total_cost = token_cost(
        req.llm.model_name, usage.prompt_tokens, usage.completion_tokens,
    )

    if log_to_wandb:
        try:
            exp_group_name = str(log_to_wandb)
            wandb.init(
                project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
            )
            wandb.config.update(
                {
                    "s1_topics/model": req.llm.model_name,
                    "s1_topics/user_prompt": req.llm.user_prompt,
                    "s1_topics/system_prompt": req.llm.system_prompt,
                },
            )
            comment_lengths = [len(c.text) for c in req.comments]
            num_topics = len(tree["taxonomy"])
            subtopic_bins = [len(t["subtopics"]) for t in tree["taxonomy"]]

            # in case comments are empty / for W&B Table logging
            comment_list = "none"
            if len(req.comments) > 1:
                comment_list = "\n".join([c.text for c in req.comments])
            comms_tree_list = [[comment_list, json.dumps(tree["taxonomy"], indent=1)]]
            wandb.log(
                {
                    "comm_N": len(req.comments),
                    "comm_text_len": sum(comment_lengths),
                    "comm_bins": comment_lengths,
                    "num_topics": num_topics,
                    "num_subtopics": sum(subtopic_bins),
                    "subtopic_bins": subtopic_bins,
                    "rows_to_tree": wandb.Table(
                        data=comms_tree_list, columns=["comments", "taxonomy"],
                    ),
                    # token counts
                    "U_tok_N/taxonomy": usage.total_tokens,
                    "U_tok_in/taxonomy": usage.prompt_tokens,
                    "U_tok_out/taxonomy": usage.completion_tokens,
                    "cost/s1_topics": s1_total_cost,
                },
            )
        except Exception:
            print("Failed to create wandb run")
    # NOTE:we could return a dictionary with one key "taxonomy", or the raw taxonomy list directly
    # choosing the latter for now
    response_data = {
        "data": tree["taxonomy"],
        "usage": usage.model_dump(),
        "cost": s1_total_cost,
    }
    
    # Filter PII from final output for user privacy
    return sanitize_for_output(response_data)


def comment_to_claims(llm: dict, comment: str, tree: dict, api_key: str, comment_index: int = -1, report_id: str = None) -> dict:
    """Given a comment and the full taxonomy/topic tree for the report, extract one or more claims from the comment.

    Args:
        llm (dict): The LLM configuration, including model name, system prompt, and user prompt.
        comment (str): The comment text to analyze and extract claims from.
        tree (dict): The taxonomy/topic tree to provide context for the comment.
        api_key (str): The API key for authenticating with the OpenAI client.
        report_id (str, optional): Optional report ID for logging context.

    Returns:
        dict: A dictionary containing the extracted claims and usage information.
    """
    client = OpenAI(api_key=api_key)
    report_logger = get_report_logger(None, report_id)

    # Basic sanitization check
    sanitized_comment, is_safe = basic_sanitize(comment, "comment_to_claims")
    if not is_safe:
        report_logger.warning(f"Rejecting unsafe comment in comment_to_claims")
        return {"claims": {"claims": []}, "usage": None}

    # Create structured output schema from taxonomy
    # This physically constrains the LLM to only generate valid topic/subtopic names
    # TypeScript always sends: tree: { taxonomy: [...] }
    taxonomy_list = tree.get("taxonomy", [])

    if not taxonomy_list:
        report_logger.error(f"Empty taxonomy in tree object")
        raise ValueError("Empty taxonomy - cannot create structured output schema")

    ClaimsSchema = create_claims_schema_from_taxonomy(taxonomy_list)

    # Build prompt with explicit taxonomy constraints
    # This is "belt and suspenders" with structured outputs
    taxonomy_constraints = create_taxonomy_prompt_with_constraints(taxonomy_list)
    full_prompt = llm.user_prompt + "\n\n" + taxonomy_constraints + "\n\nComment:\n" + sanitized_comment

    # Track API call
    api_tracker.track_call('comment_to_claims', {
        'comment_index': comment_index,
        'comment_length': len(comment),
        'tree_size': len(taxonomy_list),
        'model': llm.model_name,
        'structured_outputs': True
    })
    if comment_index >= 0:
        report_logger.info(f"API Call #{api_tracker.total_calls}: comment_to_claims (comment #{comment_index + 1})")

    # Make the API call with structured outputs (required)
    response = client.beta.chat.completions.parse(
        model=llm.model_name,
        messages=[
            {"role": "system", "content": llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format=ClaimsSchema,
    )

    # Extract parsed object - model_dump(mode='json') properly serializes enums to strings
    parsed_claims = response.choices[0].message.parsed
    claims_list = [claim.model_dump(mode='json') for claim in parsed_claims.claims]

    # Log if no claims extracted (for debugging empty reports)
    if len(claims_list) == 0:
        report_logger.warning(f"Structured outputs returned 0 claims for comment {comment_index + 1}. Comment length: {len(comment)}")
    else:
        report_logger.info(f"Extracted {len(claims_list)} claims for comment {comment_index + 1}")

    claims_obj = {"claims": claims_list}
    return {"claims": claims_obj, "usage": response.usage}


async def comment_to_claims_async(processing_context: dict, llm: dict, comment: str, tree: dict, api_key: str, comment_index: int = -1) -> dict:
    """Async wrapper for comment_to_claims with concurrency control and progress tracking"""
    async with concurrency_semaphore:
        try:
            # Add backpressure delay to prevent API rate limiting
            if API_RATE_LIMIT_DELAY > 0:
                await asyncio.sleep(API_RATE_LIMIT_DELAY)

            # Run the synchronous function in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                comment_to_claims,
                llm, comment, tree, api_key, comment_index, processing_context.get("report_id")
            )
            
            # Update progress stats
            processing_tracker.update_progress(processing_context["request_id"])
            
            return result
        except Exception as e:
            # Still update progress on error to avoid appearing stalled
            processing_tracker.update_progress(processing_context["request_id"])
            raise e


####################################
# Step 2: Extract and place claims #
# ----------------------------------#
@app.post("/claims")
async def all_comments_to_claims(
    req: CommentTopicTree, x_openai_api_key: str = Header(..., alias="X-OpenAI-API-Key"), x_report_id: str = Header(None, alias="X-Report-ID"), x_user_id: str = Header(None, alias="X-User-ID"), log_to_wandb: str = config.WANDB_GROUP_LOG_NAME, dry_run = False
) -> dict:
    """Given a comment and the taxonomy/topic tree for the report, extract one or more claims from the comment.
    Place each claim under the correct subtopic in the tree.

    Input format:
    - CommentTopicTree object: JSON/dictionary with the following fields:
      - comments: a list of Comment (each has a field, "text", for the raw text of the comment, and an id)
      - llm: a dictionary of the LLM configuration:
        - model_name: a string of the name of the LLM to call ("gpt-4o-mini", "gpt-4-turbo-preview")
        - system_prompt: a string of the system prompt
        - user_prompt: a string of the user prompt to convert the raw comments into the
                             taxonomy/topic tree
     - tree: a dictionary of the topics and nested subtopics, and their titles/descriptions
    Example:
    {
      "llm": {
          "model_name": "gpt-4o-mini",
          "system_prompt": "\n\tYou are a professional research assistant.",
          "user_prompt": "\nI'm going to give you a comment made by a participant",
      },
      "comments": [
          {
              "id": "c1",
              "text": "I love cats"
          },
          {
              "id": "c2",
              "text": "dogs are great"
          },
          {
              "id": "c3",
              "text": "I'm not sure about birds"
          }
      ],
      "tree": [
                {
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
                }
             ]
    }

    Output format:
    - data: the dictionary of topics and subtopics with extracted claims listed under the
                   correct subtopic, along with the source quote
    - usage: a dictionary of token counts for the LLM calls of this pipeline step
      - completion_tokens
      - prompt_tokens
      - total_tokens

    Example output:
    {
      "data": {
          "Pets": {
              "total": 3,
              "subtopics": {
                  "Cats": {
                      "total": 1,
                      "claims": [
                          {
                              "claim": "Cats are the best household pets.",
                              "commentId":"c1",
                              "quote": "I love cats",
                              "topicName": "Pets",
                              "subtopicName": "Cats"
                          }
                      ]
                  },
                  "Dogs": {
                      "total": 1,
                      "claims": [
                          {
                              "claim": "Dogs are superior pets.",
                              "commentId":"c2",
                              "quote": "dogs are great",
                              "topicName": "Pets",
                              "subtopicName": "Dogs"
                          }
                      ]
                  },
                  "Birds": {
                      "total": 1,
                      "claims": [
                          {
                              "claim": "Birds are not suitable pets for everyone.",
                              "commentId":"c3",
                              "quote": "I'm not sure about birds.",
                              "topicName": "Pets",
                              "subtopicName": "Birds"
                          }
                      ]
                  }
              }
          }
      }
    }
    """
    # skip calling an LLM
    if dry_run or config.DRY_RUN:
        print("dry_run claims")
        return config.MOCK_RESPONSE["claims"]

    # Get report-specific logger
    report_logger = get_report_logger(x_user_id, x_report_id)

    comms_to_claims = []
    comms_to_claims_html = []
    TK_2_IN = 0
    TK_2_OUT = 0
    TK_2_TOT = 0

    node_counts = {}

    # Initialize request-scoped processing tracking
    request_id = f"claims_{int(time.time() * 1000)}_{id(req)}"
    processing_tracker.start_request(request_id, len(req.comments))

    # Clean up stale requests periodically to prevent memory leaks
    processing_tracker.cleanup_stale_requests()

    # Log processing start
    report_logger.info(f"Starting claims extraction for {len(req.comments)} comments")

    # Check if concurrent processing is enabled
    comment_count = len(req.comments)
    if ENABLE_CONCURRENT_PROCESSING:
        report_logger.info(f"Processing {comment_count} comments with concurrent processing (concurrency: {MAX_CONCURRENCY})")
    else:
        report_logger.info(f"Processing {comment_count} comments sequentially (concurrent processing disabled)")
    
    try:
        # Filter meaningful comments first
        meaningful_comments = []
        for i_c, comment in enumerate(req.comments):
            if comment_is_meaningful(comment.text):
                meaningful_comments.append((i_c, comment))
            else:
                print(f"warning: empty comment in claims: comment #{i_c}")
        
        # Process comments based on concurrency setting
        processing_context = {"request_id": request_id, "report_id": x_report_id}
        responses = []
        
        if ENABLE_CONCURRENT_PROCESSING:
            # Process comments concurrently
            tasks = []
            for i_c, comment in meaningful_comments:
                task = comment_to_claims_async(processing_context, req.llm, comment.text, req.tree, x_openai_api_key, comment_index=i_c)
                tasks.append((task, comment))
            
            # Wait for all tasks to complete and track failures
            responses_with_comments = await asyncio.gather(*[task for task, _ in tasks], return_exceptions=True)
            responses = list(zip(responses_with_comments, [comment for _, comment in meaningful_comments]))
            
            # Count and log failures for monitoring
            failed_count = sum(1 for response, _ in responses if isinstance(response, Exception))
            if failed_count > 0:
                success_rate = ((len(responses) - failed_count) / len(responses)) * 100
                report_logger.warning(f"Concurrent processing completed with {failed_count}/{len(responses)} failures (success rate: {success_rate:.1f}%)")

                # If more than 50% failed, this might indicate a systemic issue
                if failed_count > len(responses) / 2:
                    report_logger.error(f"High failure rate detected: {failed_count}/{len(responses)} failed. This may indicate an API or system issue.")
            else:
                report_logger.info(f"Concurrent processing completed successfully for all {len(responses)} comments")
        else:
            # Process comments sequentially (original behavior)
            for i_c, comment in meaningful_comments:
                try:
                    response = comment_to_claims(req.llm, comment.text, req.tree, x_openai_api_key, comment_index=i_c, report_id=x_report_id)
                    responses.append((response, comment))
                    processing_tracker.update_progress(request_id)
                except Exception as e:
                    print(f"Error processing comment {comment.id}: {e}")
                    responses.append((e, comment))
        
        # Process results
        for response, comment in responses:
            if isinstance(response, Exception):
                print(f"Error processing comment {comment.id}: {response}")
                continue  # Skip to next response for exceptions
                
            try:
                claims = response["claims"]
                for claim in claims["claims"]:
                    claim.update({"commentId": comment.id, "speaker": comment.speaker})
            except Exception:
                print("Step 2: no claims for comment: ", response)
                claims = None
                continue
                
            usage = response["usage"]
            if claims and len(claims["claims"]) > 0:
                comms_to_claims.extend([c for c in claims["claims"]])

            # Handle cases where usage is None (e.g., when content is rejected by sanitization)
            if usage is not None:
                TK_2_IN += usage.prompt_tokens
                TK_2_OUT += usage.completion_tokens
                TK_2_TOT += usage.total_tokens
            else:
                print(f"Warning: Sanitization rejected content for comment {comment.id}, usage data unavailable")

            # format for logging to W&B
            if log_to_wandb and claims:
                viz_claims = cute_print(claims["claims"])
                comms_to_claims_html.append([comment.text, viz_claims])


        # reference format
        # [{'claim': 'Cats are the best household pets.', 'commentId':'c1', 'quote': 'I love cats', 'speaker' : 'Alice', 'topicName': 'Pets', 'subtopicName': 'Cats'},
        # {'commentId':'c2','claim': 'Dogs are superior pets.', 'quote': 'dogs are great', 'speaker' : 'Bob', 'topicName': 'Pets', 'subtopicName': 'Dogs'},
        # {'commentId':'c3', 'claim': 'Birds are not suitable pets for everyone.', 'quote': "I'm not sure about birds.", 'speaker' : 'Alice', 'topicName': 'Pets', 'subtopicName': 'Birds'}]

        # count the claims in each subtopic
        for claim in comms_to_claims:
            if "topicName" not in claim:
                print("claim unassigned to topic: ", claim)
                continue
            if claim["topicName"] in node_counts:
                node_counts[claim["topicName"]]["total"] += 1
                node_counts[claim["topicName"]]["speakers"].add(claim["speaker"])
                if "subtopicName" in claim:
                    if (
                        claim["subtopicName"]
                        in node_counts[claim["topicName"]]["subtopics"]
                    ):
                        node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]][
                            "total"
                        ] += 1
                        node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]][
                            "claims"
                        ].append(claim)
                        node_counts[claim["topicName"]]["subtopics"][claim["subtopicName"]][
                            "speakers"
                        ].add(claim["speaker"])
                    else:
                        node_counts[claim["topicName"]]["subtopics"][
                            claim["subtopicName"]
                        ] = {
                            "total": 1,
                            "claims": [claim],
                            "speakers": set([claim["speaker"]]),
                        }
            else:
                node_counts[claim["topicName"]] = {
                    "total": 1,
                    "speakers": set([claim["speaker"]]),
                    "subtopics": {
                        claim["subtopicName"]: {
                            "total": 1,
                            "claims": [claim],
                            "speakers": set([claim["speaker"]]),
                        },
                    },
                }
        # after inserting claims: check if any of the topics/subtopics are empty
        for topic in req.tree["taxonomy"]:
            if "subtopics" in topic:
                for subtopic in topic["subtopics"]:
                    # check if subtopic in node_counts
                    if topic["topicName"] in node_counts:
                        if (
                            subtopic["subtopicName"]
                            not in node_counts[topic["topicName"]]["subtopics"]
                        ):
                            # this is an empty subtopic!
                            print("EMPTY SUBTOPIC: ", subtopic["subtopicName"])
                            node_counts[topic["topicName"]]["subtopics"][
                                subtopic["subtopicName"]
                            ] = {"total": 0, "claims": [], "speakers": set()}
                    else:
                        # could we have an empty topic? certainly
                        print("EMPTY TOPIC: ", topic["topicName"])
                        node_counts[topic["topicName"]] = {
                            "total": 0,
                            "speakers": set(),
                            "subtopics": {
                                "None": {"total": 0, "claims": [], "speakers": set()},
                            },
                        }
        # compute LLM costs for this step's tokens
        s2_total_cost = token_cost(req.llm.model_name, TK_2_IN, TK_2_OUT)

        # Note: we will now be sending speaker names to W&B
        if log_to_wandb:
            try:
                exp_group_name = str(log_to_wandb)
                wandb.init(
                    project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
                )
                wandb.config.update(
                    {
                        "s2_claims/model": req.llm.model_name,
                        "s2_claims/user_prompt": req.llm.user_prompt,
                        "s2_claims/system_prompt": req.llm.system_prompt,
                    },
                )
                wandb.log(
                    {
                        "U_tok_N/claims": TK_2_TOT,
                        "U_tok_in/claims": TK_2_IN,
                        "U_tok_out/claims": TK_2_OUT,
                        "rows_to_claims": wandb.Table(
                            data=comms_to_claims_html, columns=["comments", "claims"],
                        ),
                        "cost/s2_claims": s2_total_cost,
                    },
                )
            except Exception:
                print("Failed to log wandb run")

        net_usage = {
            "total_tokens": TK_2_TOT,
            "prompt_tokens": TK_2_IN,
            "completion_tokens": TK_2_OUT,
        }
        
        response_data = {"data": node_counts, "usage": net_usage, "cost": s2_total_cost}
        # Filter PII from final output for user privacy
        return sanitize_for_output(response_data)
    finally:
        # Ensure request tracking is always cleaned up to prevent memory leaks
        processing_tracker.end_request(request_id)


def dedup_claims(claims: list, llm: LLMConfig, api_key: str, topic_name: str = "", subtopic_name: str = "", report_id: str = None) -> dict:
    """Given a list of claims for a given subtopic, identify which ones are near-duplicates.

    Args:
        claims (list): A list of claims to be deduplicated.
        llm (LLMConfig): The LLM configuration containing prompts and model details.
        api_key (str): The API key for authenticating with the OpenAI client.
        report_id (str): Optional report ID for logging context.

    Returns:
        dict: A dictionary containing the deduplicated claims and usage information.
    """
    client = OpenAI(api_key=api_key)
    report_logger = get_report_logger(None, report_id)

    # add claims with enumerated ids (relative to this subtopic only)
    # Include claim text, quote text, and IDs so LLM can group effectively
    full_prompt = llm.user_prompt
    for i, orig_claim in enumerate(claims):
        # Basic sanitization check
        sanitized_claim, is_safe_claim = basic_sanitize(orig_claim["claim"], f"dedup_claim_{i}")
        sanitized_quote, is_safe_quote = basic_sanitize(orig_claim.get("quote", ""), f"dedup_quote_{i}")

        if is_safe_claim and is_safe_quote:
            full_prompt += f"\nclaimId{i}:"
            full_prompt += f"\n  - claim: {sanitized_claim}"
            full_prompt += f"\n  - quote: {sanitized_quote}"
            full_prompt += f"\n  - quoteId: quote{i}"
        else:
            report_logger.warning(f"Skipping unsafe claim or quote in dedup")
    
    # Basic prompt length check
    full_prompt = sanitize_prompt_length(full_prompt)
    
    # Track API call
    api_tracker.track_call('dedup_claims', {
        'topic': topic_name,
        'subtopic': subtopic_name,
        'num_claims': len(claims),
        'model': config.MODEL
    })
    report_logger.info(f"API Call #{api_tracker.total_calls}: dedup_claims ({topic_name}/{subtopic_name}, {len(claims)} claims)")

    response = client.chat.completions.create(
        model=config.MODEL,
        messages=[
            {"role": "system", "content": llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    try:
        deduped_claims = response.choices[0].message.content
    except Exception:
        print("Step 3: no deduped claims: ", response)
        deduped_claims = {}
    try:
        deduped_claims_obj = json.loads(deduped_claims)
    except JSONDecodeError:
        logger.error(f"JSON parse failure in dedup_claims, returning empty result")
        logger.error(f"json failure;dedup: {deduped_claims[:500]}")  # Only print first 500 chars
        deduped_claims_obj = {"groupedClaims": []}  # Return empty but valid structure
    return {"dedup_claims": deduped_claims_obj, "usage": response.usage}


#####################################
# Step 3: Sort & deduplicate claims #
# -----------------------------------#
@app.put("/sort_claims_tree/")
def sort_claims_tree(
    req: ClaimTreeLLMConfig, x_openai_api_key: str = Header(..., alias="X-OpenAI-API-Key"), x_report_id: str = Header(None, alias="X-Report-ID"), x_user_id: str = Header(None, alias="X-User-ID"), log_to_wandb: str = config.WANDB_GROUP_LOG_NAME, dry_run = False
) -> dict:
    """Sort the topic/subtopic tree so that the most popular claims, subtopics, and topics
    all appear first. Deduplicate claims within each subtopic so that any near-duplicates appear as
    nested/child objects of a first-in parent claim, under the key "duplicates"

    Input format:
    - ClaimTree object: JSON/dictionary with the following fields
      - tree: the topic tree / full taxonomy of topics, subtopics, and claims (each with their full schema,
              including the claim, quote, topic, and subtopic)
    Example input tree:
    {
     "tree" : {
      "Pets": {
          "total": 5,
          "subtopics": {
              "Cats": {
                  "total": 2,
                  "claims": [
                      {
                          "claim": "Cats are the best pets.",
                          "commentId":"c1",
                          "quote": "I love cats.",
                          "topicName": "Pets",
                          "subtopicName": "Cats"
                      },
                      {
                          "claim": "Cats are the best pets.",
                          "commentId":"c1",
                          "quote": "I really really love cats",
                          "topicName": "Pets",
                          "subtopicName": "Cats"
                      }
                  ]
              },
              "Dogs": {
                  "total": 1,
                  "claims": [
                      {
                          "claim": "Dogs are superior pets.",
                          "commentId":"c2",
                          "quote": "dogs are great",
                          "topicName": "Pets",
                          "subtopicName": "Dogs"
                      }
                  ]
              },
              "Birds": {
                  "total": 2,
                  "claims": [
                      {
                          "claim": "Birds are not ideal pets for everyone.",
                          "commentId":"c3",
                          "quote": "I'm not sure about birds.",
                          "topicName": "Pets",
                          "subtopicName": "Birds"
                      },
                      {
                          "claim": "Birds are not suitable pets for everyone.",
                          "commentId":"c3",
                          "quote": "I don't know about birds.",
                          "topicName": "Pets",
                          "subtopicName": "Birds"
                      }
                  ]
              }
          }
      }
     }
    }
    Output format:
    - response object: JSON/dictionary with the following fields
      - data: the deduplicated claims & correctly sorted topic tree / full taxonomy of topics, subtopics,
              and claims, where the most popular topics/subtopics/claims (by near-duplicate count) appear
              first within each level of nesting
      - usage: token counts for the LLM calls of the deduplication step of the pipeline
        - completion_tokens
        - prompt_tokens
        - total_tokens

    Example output tree:
    [
      [
          "Pets",
          {
              "num_speakers" : 5,
              "speakers" : [
                  "Alice",
                  "Bob",
                  "Charles",
                  "Dany",
                  "Elinor"
              ],
              "num_claims": 5,
              "topics": [
                  [
                      "Cats",
                      {
                          "num_claims": 2,
                          "claims": [
                              {
                                  "claim": "Cats are the best pets.",
                                  "commentId":"c1",
                                  "quote": "I love cats.",
                                  "speaker" : "Alice",
                                  "topicName": "Pets",
                                  "subtopicName": "Cats",
                                  "duplicates": [
                                      {
                                          "claim": "Cats are the best pets.",
                                          "commendId:"c1"
                                          "quote": "I really really love cats",
                                          "speaker" : "Elinor",
                                          "topicName": "Pets",
                                          "subtopicName": "Cats",
                                          "duplicated": true
                                      }
                                  ]
                              }
                          ]
                          "num_speakers" : 2,
                          "speakers" : [
                              "Alice",
                              "Elinor"
                          ]
                      }
                  ],
                  [
                      "Birds",
                      {
                          "num_claims": 2,
                          "claims": [
                              {
                                  "claim": "Birds are not ideal pets for everyone.",
                                  "commentId:"c3",
                                  "quote": "I'm not sure about birds.",
                                  "speaker" : "Charles",
                                  "topicName": "Pets",
                                  "subtopicName": "Birds",
                                  "duplicates": [
                                      {
                                          "claim": "Birds are not suitable pets for everyone.",
                                          "commentId" "c3",
                                          "quote": "I don't know about birds.",
                                          "speaker": "Dany",
                                          "topicName": "Pets",
                                          "subtopicName": "Birds",
                                          "duplicated": true
                                      }
                                  ]
                              }
                          ]
                          "num_speakers" : 2,
                          "speakers" : [
                              "Charles",
                              "Dany"
                          ]
                      }
                  ],
                  [
                      "Dogs",
                      {
                          "num_claims": 1,
                          "claims": [
                              {
                                  "claim": "Dogs are superior pets.",
                                  "commentId": "c2",
                                  "quote": "dogs are great",
                                  "speaker" : "Bob",
                                  "topicName": "Pets",
                                  "subtopicName": "Dogs"
                              }
                          ]
                          "num_speakers" : 1,
                          "speakers" : [
                              "Bob"
                          ]

                      }
                  ]
              ]
          }
      ]
    ]

    For each subtopic, send the contained claims to an LLM to detect near-duplicates.
    These will be returned as dictionaries, where the keys are all the claims for the subtopic,
    numbered with relative ids (claimId0, claimId1, claimId2...claimIdN-1 for N claims), and the
    value for each claim id is a list of the relative claim ids of any near-duplicates.
    Note that this mapping is not guaranteed to be symmetric: claimId0 may have an empty list,
    but claimId1 may have claimId0 and claimId2 in the list. Hence we build a dictionary of
    all the relative ids encountered, and return near duplicates accounting for this asymmetry.

    After deduplication, the full tree of topics, subtopics, and their claims is sorted:
    - more frequent topics appear first
    - within each topic, more frequent subtopics appear first
    - within each subtopic, claims with the most duplicates (ie most supporting quotes) appear first
    Note that currently these duplicates are not counted towards the total claims in a subtopic/topic
    for sorting at the higher levels.

    For now, "near-duplicates" have similar meanings—this is not exact/identical claims and
    we may want to refine this in the future.

    We may also want to allow for other sorting/filtering styles, where the number of duplicates
    DOES matter, or where we want to sum the claims by a particular speaker or by other metadata
    towards the total for a subtopic/topic.
    """
    # skip calling an LLM
    if dry_run or config.DRY_RUN:
       print("dry_run sort tree")
       return config.MOCK_RESPONSE["sort_claims_tree"]

    # Get report-specific logger
    report_logger = get_report_logger(x_user_id, x_report_id)

    claims_tree = req.tree
    llm = req.llm
    TK_IN = 0
    TK_OUT = 0
    TK_TOT = 0
    dupe_logs = []
    sorted_tree = {}

    for topic, topic_data in claims_tree.items():
        per_topic_total = 0
        per_topic_list = {}
        # consider the empty top-level topic
        if not topic_data["subtopics"]:
            print("NO SUBTOPICS: ", topic)
        for subtopic, subtopic_data in topic_data["subtopics"].items():
            per_topic_total += subtopic_data["total"]
            per_topic_speakers = set()
            # canonical order of claims: as they appear in subtopic_data["claims"]
            # no need to deduplicate single claims
            if subtopic_data["total"] > 1:
                try:
                    response = dedup_claims(subtopic_data["claims"], llm=llm, api_key=x_openai_api_key, topic_name=topic, subtopic_name=subtopic, report_id=x_report_id)
                except Exception:
                    print(
                        "Step 3: no deduped claims response for: ",
                        subtopic_data["claims"],
                    )
                    continue
                deduped = response["dedup_claims"]
                usage = response["usage"]

                # Process grouped claims from LLM deduplication
                deduped_claims = []
                accounted_claim_ids = set()

                # Process grouped claims format
                # Each group consolidates multiple claims/quotes under a single higher-level claim
                for group in deduped.get("groupedClaims", []):
                    # Extract originalClaimIds - these reference indices in subtopic_data["claims"]
                    original_claim_ids = []
                    for claim_id_str in group.get("originalClaimIds", []):
                        try:
                            if isinstance(claim_id_str, str) and "claimId" in claim_id_str:
                                original_claim_ids.append(int(claim_id_str.replace("claimId", "")))
                            elif isinstance(claim_id_str, int):
                                original_claim_ids.append(claim_id_str)
                        except (ValueError, IndexError):
                            logger.warning(f"Could not parse claim ID: {claim_id_str}")
                            continue

                    if not original_claim_ids:
                        logger.warning(f"Group has no valid claim IDs: {group}")
                        continue

                    # Validate all claim IDs are within bounds
                    valid_claim_ids = [
                        cid for cid in original_claim_ids
                        if cid < len(subtopic_data["claims"])
                    ]
                    if not valid_claim_ids:
                        logger.warning(f"Group has no valid claim IDs within bounds: {original_claim_ids}")
                        continue

                    # Track which claims we've accounted for
                    accounted_claim_ids.update(valid_claim_ids)

                    # Use the first claim as the base, but with the new grouped claim text
                    primary_claim_id = valid_claim_ids[0]
                    base_claim = subtopic_data["claims"][primary_claim_id]

                    # Create the new grouped claim with aggregated quotes
                    grouped_claim = {k: v for k, v in base_claim.items()}
                    # Use LLM's grouped claim text, fallback to original if empty/missing
                    claim_text = group.get("claimText", "").strip() or base_claim["claim"]
                    grouped_claim["claim"] = claim_text
                    grouped_claim["duplicates"] = []

                    # Add all speakers to the topic speaker set
                    if "speaker" in base_claim:
                        per_topic_speakers.add(base_claim["speaker"])

                    # Add the remaining claims as duplicates (with their original quotes)
                    for claim_id in valid_claim_ids[1:]:
                        dupe_claim = {k: v for k, v in subtopic_data["claims"][claim_id].items()}
                        dupe_claim["duplicated"] = True
                        grouped_claim["duplicates"].append(dupe_claim)

                        # Add their speakers too
                        if "speaker" in dupe_claim:
                            per_topic_speakers.add(dupe_claim["speaker"])

                    deduped_claims.append(grouped_claim)

                # Validate all claims were grouped - add missing claims as single-item groups
                all_claim_ids = set(range(len(subtopic_data["claims"])))
                missing_claim_ids = all_claim_ids - accounted_claim_ids
                if missing_claim_ids:
                    logger.warning(
                        f"LLM missed {len(missing_claim_ids)} claims in grouping for {subtopic}, "
                        f"adding them as single-item groups"
                    )
                    for missing_id in sorted(missing_claim_ids):
                        claim = {k: v for k, v in subtopic_data["claims"][missing_id].items()}
                        claim["duplicates"] = []
                        if "speaker" in claim:
                            per_topic_speakers.add(claim["speaker"])
                        deduped_claims.append(claim)


                # Preserve all claims - single-quote claims may represent important minority voices
                # The aggressive deduplication prompt should have already consolidated similar claims
                # Any remaining single-quote claims likely represent unique perspectives worth preserving
                filtered_deduped_claims = deduped_claims

                # Log statistics about claim distribution for monitoring
                single_quote_count = sum(1 for c in deduped_claims if len(c["duplicates"]) == 0)
                multi_quote_count = len(deduped_claims) - single_quote_count
                if single_quote_count > 0:
                    report_logger.info(
                        f"{subtopic}: {multi_quote_count} grouped claims, {single_quote_count} unique single-voice claims preserved"
                    )

                # sort so the most duplicated claims are first
                sorted_deduped_claims = sorted(
                    filtered_deduped_claims, key=lambda x: len(x["duplicates"]), reverse=True,
                )
                if log_to_wandb:
                    dupe_logs.append(
                        [
                            json.dumps(subtopic_data["claims"], indent=1),
                            json.dumps(sorted_deduped_claims, indent=1),
                        ],
                    )

                TK_TOT += usage.total_tokens
                TK_IN += usage.prompt_tokens
                TK_OUT += usage.completion_tokens
            else:
                sorted_deduped_claims = subtopic_data["claims"]
                # there may be one unique claim or no claims if this is an empty subtopic
                if subtopic_data["claims"]:
                    if "speaker" in subtopic_data["claims"][0]:
                        speaker = subtopic_data["claims"][0]["speaker"]
                    else:
                        print("no speaker provided:", claim)
                        speaker = "unknown"
                    per_topic_speakers.add(speaker)
                else:
                    print("EMPTY SUBTOPIC AFTER CLAIMS: ", subtopic)

            # track how many claims and distinct speakers per subtopic
            tree_counts = {
                "claims": subtopic_data["total"],
                "speakers": len(per_topic_speakers),
            }
            # add list of sorted, deduplicated claims to the right subtopic node in the tree
            per_topic_list[subtopic] = {
                "claims": sorted_deduped_claims,
                "speakers": list(per_topic_speakers),
                "counts": tree_counts,
            }

        # sort all the subtopics in a given topic
        # two ways of sorting 1/16:
        # - (default) numPeople: count the distinct speakers per subtopic/topic
        # - numClaims: count the total claims per subtopic/topic
        set_topic_speakers = set()
        for k, c in per_topic_list.items():
            set_topic_speakers = set_topic_speakers.union(c["speakers"])

        if req.sort == "numPeople":
            sorted_subtopics = sorted(
                per_topic_list.items(),
                key=lambda x: x[1]["counts"]["speakers"],
                reverse=True,
            )
        elif req.sort == "numClaims":
            sorted_subtopics = sorted(
                per_topic_list.items(),
                key=lambda x: x[1]["counts"]["claims"],
                reverse=True,
            )
        # track how many claims and distinct speakers per subtopic
        tree_counts = {"claims": per_topic_total, "speakers": len(set_topic_speakers)}
        # we have to add all the speakers
        sorted_tree[topic] = {
            "topics": sorted_subtopics,
            "speakers": list(set_topic_speakers),
            "counts": tree_counts,
        }

    # sort all the topics in the tree
    if req.sort == "numPeople":
        full_sort_tree = sorted(
            sorted_tree.items(), key=lambda x: x[1]["counts"]["speakers"], reverse=True,
        )
    elif req.sort == "numClaims":
        full_sort_tree = sorted(
            sorted_tree.items(), key=lambda x: x[1]["counts"]["claims"], reverse=True,
        )

    # compute LLM costs for this step's tokens
    s3_total_cost = token_cost(req.llm.model_name, TK_IN, TK_OUT)

    if log_to_wandb:
        try:
            exp_group_name = str(log_to_wandb)
            wandb.init(
                project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
            )
            wandb.config.update(
                {
                    "s3_dedup/model": req.llm.model_name,
                    "s3_dedup/user_prompt": req.llm.user_prompt,
                    "s3_dedup/system_prompt": req.llm.system_prompt,
                },
            )

            report_data = [[json.dumps(full_sort_tree, indent=2)]]
            wandb.log(
                {
                    "U_tok_N/dedup": TK_TOT,
                    "U_tok_in/dedup": TK_IN,
                    "U_tok_out/dedup": TK_OUT,
                    "deduped_claims": wandb.Table(
                        data=dupe_logs, columns=["full_flat_claims", "deduped_claims"],
                    ),
                    "t3c_report": wandb.Table(data=report_data, columns=["t3c_report"]),
                    "cost/s3_dedup": s3_total_cost,
                },
            )
            # W&B run completion
            wandb.run.finish()
        except Exception:
            print("Failed to create wandb run")
    net_usage = {
        "total_tokens": TK_TOT,
        "prompt_tokens": TK_IN,
        "completion_tokens": TK_OUT,
    }

    response_data = {"data": full_sort_tree, "usage": net_usage, "cost": s3_total_cost}
    
    # Filter PII from final output for user privacy
    return sanitize_for_output(response_data)


########################################
# Step 4: Generate Topic Summaries    #
# -------------------------------------#
@app.post("/topic_summaries")
def generate_topic_summaries(
    req: dict, x_openai_api_key: str = Header(..., alias="X-OpenAI-API-Key"), x_report_id: str = Header(None, alias="X-Report-ID"), x_user_id: str = Header(None, alias="X-User-ID"), log_to_wandb: str = config.WANDB_GROUP_LOG_NAME, dry_run = False
) -> dict:
    """Generate summaries for each topic based on the complete processed tree with all claims.

    Input format:
    - tree: the fully processed topic tree with all claims, duplicates handled
    - llm: LLM configuration with model, system prompt, and user prompt

    Output format:
    - summaries: array of topic summaries with topicName and summary
    - usage: token usage information
    - cost: cost information
    """
    if dry_run or config.DRY_RUN:
        print("dry_run topic summaries")
        return {"summaries": [], "usage": {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0}, "cost": 0.0}

    client = OpenAI(api_key=x_openai_api_key)

    # Extract topics and their data for summarization
    tree_data = req["tree"]
    llm_config = req["llm"]

    # Build the prompt with all topic information
    full_prompt = llm_config["user_prompt"]
    full_prompt += "\n" + json.dumps(tree_data, indent=2)

    # Basic prompt length check
    full_prompt = sanitize_prompt_length(full_prompt)

    response = client.chat.completions.create(
        model=llm_config["model_name"],
        messages=[
            {"role": "system", "content": llm_config["system_prompt"]},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )

    try:
        summaries_result = json.loads(response.choices[0].message.content)
    except Exception:
        print("Step 4: no topic summaries: ", response)
        summaries_result = {"summaries": []}

    usage = response.usage
    # compute LLM costs for this step's tokens
    s4_total_cost = token_cost(
        llm_config["model_name"], usage.prompt_tokens, usage.completion_tokens,
    )

    if log_to_wandb:
        try:
            exp_group_name = str(log_to_wandb)
            wandb.init(
                project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
            )
            wandb.config.update(
                {
                    "s4_summaries/model": llm_config["model_name"],
                    "s4_summaries/user_prompt": llm_config["user_prompt"],
                    "s4_summaries/system_prompt": llm_config["system_prompt"],
                },
            )
            wandb.log(
                {
                    "U_tok_N/summaries": usage.total_tokens,
                    "U_tok_in/summaries": usage.prompt_tokens,
                    "U_tok_out/summaries": usage.completion_tokens,
                    "cost/s4_summaries": s4_total_cost,
                },
            )
        except Exception:
            print("Failed to create wandb run")

    net_usage = {
        "total_tokens": usage.total_tokens,
        "prompt_tokens": usage.prompt_tokens,
        "completion_tokens": usage.completion_tokens,
    }

    response_data = {
        "data": summaries_result.get("summaries", []),
        "usage": net_usage,
        "cost": s4_total_cost,
    }

    # Filter PII from final output for user privacy
    return sanitize_for_output(response_data)


###########################################
# Optional / New Feature & Research Steps #
# -----------------------------------------#
# Steps below are optional/exploratory components of the T3C LLM pipeline.


########################################
# Crux claims and controversy analysis #
# --------------------------------------#
# Our first research feature finds "crux claims" to distill the perspectives
# on each subtopic into the core controversy — summary statements on which speakers
# are most evenly split into "agree" or "disagree" sides.
# We prompt an LLM for a crux claim with an explanation, given all the speakers' claims
# on each subtopic (along with the parent topic and a short description). We anonymize
# the claims before sending them to the LLM to protect PII and minimize any potential bias
# based on known speaker identity (e.g. when processing claims made by popular writers)
def controversy_matrix(cont_mat: list) -> list:
    """Compute a controversy matrix from individual speaker opinions on crux claims,
    as predicted by an LLM. For each pair of cruxes, for each speaker:
    # - add 0 only if the speaker agrees with both cruxes
    # - add 0.5 if the speaker has an opinion on one crux, but no known opinion on the other
    # - add 1 if the speaker has a known different opinion on each crux (agree/disagree or disagree/agree)
    # Sum the totals for each pair of cruxes in the corresponding cell in the cross-product
    # and return the matrix of scores.
    """
    cm = [[0 for a in range(len(cont_mat))] for b in range(len(cont_mat))]

    # loop through all the crux statements,
    for claim_index, row in enumerate(cont_mat):
        # these are the scores for each speaker
        per_speaker_scores = row[1:]
        for score_index, score in enumerate(per_speaker_scores):
            # we want this speaker's scores for all statements except current one
            other_scores = [
                item[score_index + 1] for item in cont_mat[claim_index + 1 :]
            ]
            for other_index, other_score in enumerate(other_scores):
                # if the scores match, there is no controversy — do not add anything
                if score != other_score:
                    # we only know one of the opinions
                    if score == 0 or other_score == 0:
                        cm[claim_index][claim_index + other_index + 1] += 0.5
                        cm[claim_index + other_index + 1][claim_index] += 0.5
                    # these opinions are different — max controversy
                    else:
                        cm[claim_index][claim_index + other_index + 1] += 1
                        cm[claim_index + other_index + 1][claim_index] += 1
    return cm


def cruxes_for_topic(
    llm: dict, topic: str, topic_desc: str, claims: list, speaker_map: dict, api_key: str, subtopic_index: int = -1, report_id: str = None
) -> dict:
    """For each fully-described subtopic, provide all the relevant claims with an anonymized
    numeric speaker id, and ask the LLM for a crux claim that best splits the speakers' opinions
    on this topic (ideally into two groups of equal size for agreement vs disagreement with the crux claim).
    Requires an explicit API key in api_key.
    """
    client = OpenAI(api_key=api_key)
    report_logger = get_report_logger(None, report_id)
    claims_anon = []
    speaker_set = set()
    for claim in claims:
        if "speaker" in claim:
            speaker_anon = speaker_map[claim["speaker"]]
            speaker_set.add(speaker_anon)
            speaker_claim = speaker_anon + ":" + claim["claim"]
            claims_anon.append(speaker_claim)

    # TODO: if speaker set is too small / all one person, do not generate cruxes
    if len(speaker_set) < 2:
        print("fewer than 2 speakers: ", topic)
        return None

    # Basic sanitization for topic info
    sanitized_topic, topic_safe = basic_sanitize(topic, "cruxes_topic")
    sanitized_topic_desc, desc_safe = basic_sanitize(topic_desc, "cruxes_desc")

    if not (topic_safe and desc_safe):
        report_logger.warning(f"Rejecting unsafe topic/description in cruxes")
        return None

    full_prompt = llm.user_prompt
    full_prompt += "\nTopic: " + sanitized_topic + ": " + sanitized_topic_desc
    full_prompt += "\nParticipant claims: \n" + json.dumps(claims_anon)
    
    # Basic prompt length check
    full_prompt = sanitize_prompt_length(full_prompt)
    
    # Track API call
    api_tracker.track_call('cruxes_for_topic', {
        'topic': topic,
        'num_claims': len(claims),
        'num_speakers': len(speaker_set),
        'subtopic_index': subtopic_index,
        'model': llm.model_name
    })
    report_logger.info(f"API Call #{api_tracker.total_calls}: cruxes_for_topic ({topic}, {len(claims)} claims, {len(speaker_set)} speakers)")

    response = client.chat.completions.create(
        model=llm.model_name,
        messages=[
            {"role": "system", "content": llm.system_prompt},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    crux = response.choices[0].message.content
    try:
        crux_obj = json.loads(crux)
    except JSONDecodeError:
        crux_obj = crux
    return {"crux": crux_obj, "usage": response.usage}


def top_k_cruxes(cont_mat: list, cruxes: list, top_k: int = 0) -> list:
    """Return the top K most controversial crux pairs.
    Optionally let the caller set K, otherwise default
    to the ceiling of the square root of the number of crux claims.
    """
    if top_k == 0:
        K = min(math.ceil(math.sqrt(len(cruxes))), 10)
    else:
        K = top_k
    # let's sort a triangular half of the symmetrical matrix (diagonal is all zeros)
    scores = []
    for x in range(len(cont_mat)):
        for y in range(x + 1, len(cont_mat)):
            scores.append([cont_mat[x][y], x, y])
    all_scored_cruxes = sorted(scores, key=lambda x: x[0], reverse=True)
    top_cruxes = [
        {"score": score, "cruxA": cruxes[x], "cruxB": cruxes[y]}
        for score, x, y in all_scored_cruxes[:K]
    ]
    return top_cruxes


@app.post("/cruxes")
def cruxes_from_tree(
    req: CruxesLLMConfig, x_openai_api_key: str = Header(..., alias="X-OpenAI-API-Key"), x_report_id: str = Header(None, alias="X-Report-ID"), x_user_id: str = Header(None, alias="X-User-ID"), log_to_wandb: str = config.WANDB_GROUP_LOG_NAME, dry_run = False,
) -> dict:
    """Given a topic, description, and corresponding list of claims with numerical speaker ids, extract the
    crux claims that would best split the claims into agree/disagree sides.
    Return a crux for each subtopic which contains at least 2 claims and at least 2 speakers.
    """
    if dry_run or config.DRY_RUN:
        print("dry_run cruxes")
        return config.MOCK_RESPONSE["cruxes"]

    # Get report-specific logger
    report_logger = get_report_logger(x_user_id, x_report_id)

    cruxes_main = []
    crux_claims = []
    TK_IN = 0
    TK_OUT = 0
    TK_TOT = 0
    topic_desc = topic_desc_map(req.topics)

    # TODO: can we get this from client?
    speaker_map = full_speaker_map(req.crux_tree)
    # print("speaker ids: ", speaker_map)

    # Count total subtopics to process
    total_subtopics = sum(len(td["subtopics"]) for td in req.crux_tree.values())
    report_logger.info(f"Starting cruxes extraction for {total_subtopics} subtopics")
    
    subtopic_counter = 0
    for topic, topic_details in req.crux_tree.items():
        subtopics = topic_details["subtopics"]
        for subtopic, subtopic_details in subtopics.items():
            # all claims for subtopic
            # TODO: reduce how many subtopics we analyze for cruxes, based on minimum representation
            # in known speaker comments?
            claims = subtopic_details["claims"]
            if len(claims) < 2:
                print("fewer than 2 claims: ", subtopic)
                continue

            if subtopic in topic_desc:
                subtopic_desc = topic_desc[subtopic]
            else:
                print("no description for subtopic:", subtopic)
                subtopic_desc = "No further details"

            topic_title = topic + ", " + subtopic
            subtopic_counter += 1
            llm_response = cruxes_for_topic(
                req.llm, topic_title, subtopic_desc, claims, speaker_map, x_openai_api_key, subtopic_index=subtopic_counter, report_id=x_report_id
            )
            if not llm_response:
                print("warning: no crux response from LLM")
                continue
            try:
                crux = llm_response["crux"]["crux"]
                usage = llm_response["usage"]
            except Exception:
                print("warning: crux response parsing failed")
                continue

            ids_to_speakers = {v: k for k, v in speaker_map.items()}
            spoken_claims = [c["speaker"] + ": " + c["claim"] for c in claims]

            # create more readable table: crux only, named speakers who agree, named speakers who disagree
            crux_claim = crux["cruxClaim"]
            agree = crux["agree"]
            disagree = crux["disagree"]
            try:
                explanation = crux["explanation"]
            except Exception:
                explanation = "N/A"

            # let's add back the names to the sanitized/speaker-ids-only
            # in the agree/disagree claims
            agree = [a.split(":")[0] for a in agree]
            disagree = [a.split(":")[0] for a in disagree]
            named_agree = [a + ":" + ids_to_speakers[a] for a in agree]
            named_disagree = [d + ":" + ids_to_speakers[d] for d in disagree]
            crux_claims.append([crux_claim, named_agree, named_disagree, explanation])

            # most readable form:
            # - crux claim, explanation, agree, disagree
            # - all claims prepended with speaker names
            # - topic & subctopic, description
            cruxes_main.append(
                [
                    crux_claim,
                    explanation,
                    named_agree,
                    named_disagree,
                    json.dumps(spoken_claims, indent=1),
                    topic_title,
                    subtopic_desc,
                ],
            )

            TK_TOT += usage.total_tokens
            TK_IN += usage.prompt_tokens
            TK_OUT += usage.completion_tokens

    # convert agree/disagree to numeric scores:
    # for each crux claim, for each speaker:
    # - assign 1 if the speaker agrees with the crux
    # - assign 0.5 if the speaker disagrees
    # - assign 0 if the speaker's opinion is unknown/unspecified
    speaker_labels = sorted(speaker_map.keys())
    cont_mat = []
    for row in crux_claims:
        claim_scores = []
        for sl in speaker_labels:
            # associate the numeric id with the speaker so the LLM explanation
            # is more easily interpretable (by cross-referencing adjacent columns which have the
            # full speaker name, which is withheld from the LLM)
            labeled_speaker = speaker_map[sl] + ":" + sl
            if labeled_speaker in row[1]:
                claim_scores.append(1)
            elif labeled_speaker in row[2]:
                claim_scores.append(0.5)
            else:
                claim_scores.append(0)
        cm = [row[0]]
        cm.extend(claim_scores)
        cont_mat.append(cm)
    full_controversy_matrix = controversy_matrix(cont_mat)

    crux_claims_only = [row[0] for row in crux_claims]
    top_cruxes = top_k_cruxes(full_controversy_matrix, crux_claims_only, req.top_k)
    # compute LLM costs for this step's tokens
    s4_total_cost = token_cost(req.llm.model_name, TK_IN, TK_OUT)

    # Note: we will now be sending speaker names to W&B
    # (still not to external LLM providers, to avoid bias on crux detection and better preserve PII)
    if log_to_wandb:
        try:
            exp_group_name = str(log_to_wandb)
            wandb.init(
                project=config.WANDB_PROJECT_NAME, group=exp_group_name, resume="allow",
            )
            wandb.config.update(
                {
                    "s4_cruxes/model": req.llm.model_name,
                    "s4_cruxes/prompt": req.llm.user_prompt,
                },
            )
            log_top_cruxes = [[c["score"], c["cruxA"], c["cruxB"]] for c in top_cruxes]
            wandb.log(
                {
                    "U_tok_N/cruxes": TK_TOT,
                    "U_tok_in/cruxes": TK_IN,
                    "U_tok_out/cruxes": TK_OUT,
                    "cost/s4_cruxes": s4_total_cost,
                    "crux_details": wandb.Table(
                        data=cruxes_main,
                        columns=[
                            "crux",
                            "reason",
                            "agree",
                            "disagree",
                            "original_claims",
                            "topic, subtopic",
                            "description",
                        ],
                    ),
                    "crux_top_scores": wandb.Table(
                        data=log_top_cruxes, columns=["score", "cruxA", "cruxB"],
                    ),
                },
            )
            cols = ["crux"]
            cols.extend(speaker_labels)
            wandb.log(
                {
                    "crux_binary_scores": wandb.Table(data=cont_mat, columns=cols),
                    "crux_cmat_scores": wandb.Table(
                        data=full_controversy_matrix,
                        columns=[
                            "Crux " + str(i)
                            for i in range(len(full_controversy_matrix))
                        ],
                    ),
                    # TODO: render a visual of the controversy matrix
                    # currently matplotlib requires a GUI to generate the plot, which is incompatible with pyserver config
                    # filename = show_confusion_matrix(full_confusion_matrix, claims_only, "Test Conf Mat", "conf_mat_test.jpg")
                    # "cont_mat_img" : wandb.Image(filename)
                },
            )
        except Exception:
            print("Failed to log wandb run")

    # wrap and name fields before returning
    net_usage = {
        "total_tokens": TK_TOT,
        "prompt_tokens": TK_IN,
        "completion_tokens": TK_OUT,
    }
    # Add API call summary to response
    api_summary = api_tracker.get_summary()
    report_logger.info(f"\n=== FINAL API CALL SUMMARY ===")
    report_logger.info(f"Total API calls: {api_summary['total_calls']}")
    report_logger.info(f"Time elapsed: {api_summary['elapsed_seconds']:.1f} seconds")
    report_logger.info(f"Calls by step:")
    for step, count in api_summary['calls_per_step'].items():
        report_logger.info(f"  - {step}: {count} calls")
    report_logger.info(f"Average rate: {api_summary['average_call_rate']:.2f} calls/second")
    
    cruxes = [
        {"cruxClaim": c[0], "agree": c[1], "disagree": c[2], "explanation": c[3]}
        for c in crux_claims
    ]
    crux_response = {
        "cruxClaims": cruxes,
        "controversyMatrix": full_controversy_matrix,
        "topCruxes": top_cruxes,
        "usage": net_usage,
        "cost": s4_total_cost,
        "api_call_summary": api_summary  # Include summary in response
    }
    
    # Filter PII from final output for user privacy
    return sanitize_for_output(crux_response)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
