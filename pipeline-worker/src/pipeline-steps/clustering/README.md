# Clustering Pipeline Step

This module implements the topic tree generation (clustering) functionality for the T3C pipeline.

## Overview

Given a list of comments, this step generates a taxonomy of relevant topics and their subtopics using an LLM. Each topic and subtopic includes a short description.

## Files

- `index.ts` - Main clustering function (`commentsToTree`)
- `model.ts` - Clustering model wrapper using evaluation framework
- `types.ts` - TypeScript type definitions
- `sanitizer.ts` - Input sanitization and PII filtering
- `utils.ts` - Utility functions (validation, cost calculation, logging)
- `__tests__/clustering.test.ts` - Unit tests

## Usage

```typescript
import { commentsToTree } from "./pipeline-steps/clustering";
import type { Comment, LLMConfig } from "./pipeline-steps/types";

const comments: Comment[] = [
  { id: "c1", text: "I love cats", speaker: "Alice" },
  { id: "c2", text: "Dogs are great", speaker: "Bob" },
];

const llmConfig: LLMConfig = {
  model_name: "gpt-4o-mini",
  system_prompt: "You are a professional research assistant.",
  user_prompt: "Please organize these comments into topics and subtopics.",
};

const result = await commentsToTree(
  comments,
  llmConfig,
  process.env.OPENAI_API_KEY,
  { reportId: "report-123", userId: "user-456" },
);

console.log(result.data); // Array of topics with subtopics
console.log(result.usage); // Token usage stats
console.log(result.cost); // Estimated cost in dollars
```

## Input Format

**Comments** - Array of Comment objects:

```typescript
Comment[] = [
  {
    id: string,        // Unique comment identifier
    text: string,      // Comment text
    speaker: string,   // Speaker name/identifier
    interview?: string // Optional interview context
  }
]
```

**LLM Config** - Configuration for the LLM:

```typescript
LLMConfig = {
  model_name: string, // e.g., "gpt-4o-mini"
  system_prompt: string, // System prompt for LLM
  user_prompt: string, // User prompt template
};
```

## Output Format

```typescript
{
  data: [
    {
      topicName: string,
      topicShortDescription: string,
      subtopics: [
        {
          subtopicName: string,
          subtopicShortDescription: string
        }
      ]
    }
  ],
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number
  },
  cost: number  // Estimated cost in USD
}
```

## Features

### Comment Sanitization

- Rejects prompt injection attempts
- Filters out non-meaningful comments (too short, empty)
- Truncates oversized inputs
- Validates text safety

### PII Filtering

- Filters email addresses, phone numbers, SSNs, credit card numbers
- Applied to final output for privacy protection
- Can be disabled via `ENABLE_PII_FILTERING=false` env var

### Cost Tracking

- Calculates estimated cost based on token usage
- Supports multiple OpenAI models with different pricing tiers

### Logging

- Report-specific logging with context (userId, reportId)
- Tracks filtering decisions and processing stats

### Evaluation Framework Integration

- Uses `common/evaluations` framework for LLM calls
- Wraps OpenAI calls through `createEvaluationModel`
- Passes sanitized comments text for evaluation purposes
- Enables standardized evaluation and observability
- Can optionally use Weave for tracing and monitoring

### Quality Scoring

The module integrates with scorers from `common/evaluations/clustering/scorers`:

- **JSON Structure Scorer** - Validates output schema and field requirements
- **Topic Coverage Scorer** - Evaluates topic count and subtopic distribution
- **LLM Judge Scorer** - Uses an LLM to assess clustering quality

Scoring is performed **asynchronously** without blocking the response. The scorers run on the clustering result in the background.

**How scoring works with Weave**:

1. When `enableScoring: true`, Weave is initialized with `weave.init(weaveProjectName)`
2. The clustering LLM is called **once** to generate the taxonomy
3. Three scorers run asynchronously on that result:
   - `jsonStructureScorer` - validates the structure (no LLM call)
   - `topicCoverageScorer` - evaluates coverage metrics (no LLM call)
   - `llmJudgeScorer` - makes a **separate LLM call** to judge quality
4. **Scores are automatically sent to Weave** because:
   - All scorers are wrapped with `weave.op()` in `common/evaluations/clustering/scorers.ts`
   - When you call a `weave.op()` wrapped function after `weave.init()`, it logs to Weave
   - Weave captures: inputs, outputs, execution time, and any errors

Use `callClusteringModelWithEvaluation()` to enable scoring:

```typescript
import { callClusteringModelWithEvaluation } from "./model.js";

// Clustering happens once, evaluation runs in background
const result = await callClusteringModelWithEvaluation(
  client,
  modelName,
  systemPrompt,
  userPrompt,
  commentsText,
  {
    enableScoring: true,
    weaveProjectName: "my-project", // Optional, defaults to 'production-clustering'
  },
);

// Returns taxonomy immediately (not blocked by scoring)
console.log(result.taxonomy);
// Scores are automatically sent to Weave dashboard and logged to console
```

## Configuration

Environment variables:

- `ENABLE_PII_FILTERING` - Enable/disable PII filtering (default: true)

## Testing

```bash
npm test clustering
```
