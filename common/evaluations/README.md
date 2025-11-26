# @common/evaluations

A type-safe LLM evaluation framework built on [Weights & Biases Weave](https://wandb.ai/site/weave) for evaluating the Talk to the City pipeline components.

## Overview

This package provides evaluation infrastructure for five key pipeline stages:

- **Clustering**: Topic/subtopic taxonomy generation from raw comments
- **Extraction**: Claim extraction from comments with taxonomy alignment
- **Deduplication**: Claim grouping and consolidation
- **Summaries**: Topic and subtopic summary generation
- **Crux**: Disagreement analysis and crux finding

Each evaluation type combines:

- Typed dataset rows and model outputs
- Deterministic rule-based scorers
- LLM judge scorers for subjective quality assessment
- Unit and integration tests

## Running Evaluations

### Prerequisites

- OpenAI API key set in environment
- From the `<PROJECT_DIRECTORY>/common` directory

### Run All Evaluations

```bash
npm run eval:pipeline
```

### Run Individual Evaluations

```bash
npm run eval:clustering      # Topic/subtopic generation
npm run eval:extraction      # Claim extraction
npm run eval:deduplication   # Claim consolidation
npm run eval:summaries       # Summary generation
npm run eval:crux            # Disagreement analysis
```

### Evaluation Output

Results are logged to the Weave project "t3c-pipeline-evaluation" and displayed in the terminal, including:

- Individual scorer metrics
- Overall scores
- Execution time
- Links to Weave UI for detailed analysis

## Running Tests

### Unit Tests (Fast, Mocked)

```bash
# Run all unit tests
npm test

# Run tests for a specific evaluation type
npm test extraction
npm test deduplication

# Run all scorer unit tests
npm test -- scorers.test.ts
```

Unit tests:

- Mock Weave operations using Vitest
- Test scorer logic in isolation
- Fast execution (no LLM calls)

### Integration Tests (Slow, Real LLM Calls)

```bash
# Run all integration tests
INTEGRATION_TESTS=true npm test

# Or use the npm script
npm run test:integration
```

Integration tests:

- Make real OpenAI API calls
- Verify end-to-end Weave integration
- Skipped by default (use `INTEGRATION_TESTS=true` to enable)
- Located in `__tests__/model.integration.test.ts` files

## Dataset Row and Model Output

Each evaluation type follows a consistent pattern with strongly-typed dataset rows (inputs) and model outputs (results).
All scorers within a single evaluation must have the same types for DatasetRow and ModelOutput

### Example of a set DatasetRow and ModelOutput types

```typescript
type ExtractionDatasetRow = {
  comment: string; // User comment to extract claims from
  taxonomy: Taxonomy; // Available topics/subtopics
  expectedClaims?: LLMClaim[]; // Optional expected output for testing
};

// Model Output - What the model returns
type ExtractionModelOutput = {
  claims: LLMClaim[]; // Array of extracted claims
};
```

## Adding a New Scorer

Scorers evaluate model outputs and return structured metrics. There are two types: deterministic (rule-based) and LLM judge (uses LLM for evaluation).

### Step 1: Define Scorer Input and Output Types

In your evaluation type's `types.ts` file:

```typescript
// Scorer input type
export type YourScorerInput = {
  modelOutput: YourModelOutput;
  datasetRow: YourDatasetRow;
};

// Scorer output type
export type YourScorerOutput = {
  score: number; // Main score (0-1)
  metric1?: number; // Additional metrics
  metric2?: number;
  issues?: string[]; // Optional issues found
  error?: string; // Optional error message
};
```

### Step 2: Implement the Scorer

#### Option A: Deterministic Scorer (Rule-Based)

In your evaluation type's `scorers.ts` file:

```typescript
import weave from "weave";

export const yourScorer = weave.op(function yourScorer({
  modelOutput,
  datasetRow,
}: YourScorerInput): YourScorerOutput {
  // Validation
  if (!modelOutput?.requiredField) {
    return {
      score: 0,
      error: "Missing required field",
    };
  }

  // Score calculation logic
  let score = 1.0;
  const issues: string[] = [];

  // Example: Check if output meets quality criteria
  if (modelOutput.items.length === 0) {
    score -= 0.5;
    issues.push("No items generated");
  }

  // Example: Calculate specific metrics
  const metric1 = calculateSomeMetric(modelOutput);
  const metric2 = calculateAnotherMetric(modelOutput, datasetRow);

  return {
    score,
    metric1,
    metric2,
    issues: issues.length > 0 ? issues : undefined,
  };
});
```

#### Option B: LLM Judge Scorer

In your evaluation type's `scorers.ts` file:

```typescript
import weave from "weave";
import OpenAI from "openai";
import { EVAL_MODEL } from "../constants";

export function createYourLLMJudgeScorer(
  openaiClient: OpenAI,
): weave.Op<Function> {
  return weave.op(async function yourLLMJudgeScorer({
    modelOutput,
    datasetRow,
  }: YourScorerInput): Promise<YourLLMJudgeOutput> {
    try {
      const prompt = `Evaluate the quality of this output.

Input: ${JSON.stringify(datasetRow, null, 2)}
Output: ${JSON.stringify(modelOutput, null, 2)}

Evaluate on these criteria:
1. Criterion 1 (0-10)
2. Criterion 2 (0-10)
3. Overall quality (0-10)

Respond with JSON: {"criterion1": <score>, "criterion2": <score>, "overall": <score>, "reasoning": "<explanation>"}`;

      const response = await openaiClient.chat.completions.create({
        model: EVAL_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert evaluator. Provide objective, detailed assessments.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const evaluation = JSON.parse(
        response.choices[0].message.content || "{}",
      );

      return {
        llm_judge_score: (evaluation.overall || 0) / 10, // Normalize to 0-1
        criterion1_score: (evaluation.criterion1 || 0) / 10,
        criterion2_score: (evaluation.criterion2 || 0) / 10,
        reasoning: evaluation.reasoning || "",
      };
    } catch (error) {
      return {
        llm_judge_score: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
```

### Step 3: Add Tests

In your evaluation type's `__tests__/scorers.test.ts` file:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { yourScorer } from "../scorers";

// Mock Weave
vi.mock("weave", () => ({
  default: {
    op: (fn: Function) => fn,
  },
}));

describe("yourScorer", () => {
  it("should return perfect score for valid output", () => {
    const input = {
      modelOutput: {
        requiredField: "value",
        items: [1, 2, 3],
      },
      datasetRow: {
        /* test data */
      },
    };

    const result = yourScorer(input);

    expect(result.score).toBe(1.0);
    expect(result.error).toBeUndefined();
  });

  it("should penalize missing items", () => {
    const input = {
      modelOutput: {
        requiredField: "value",
        items: [],
      },
      datasetRow: {
        /* test data */
      },
    };

    const result = yourScorer(input);

    expect(result.score).toBeLessThan(1.0);
    expect(result.issues).toContain("No items generated");
  });
});
```

### Step 4: Register Scorer in Evaluation

In your evaluation type's `model.ts` file:

```typescript
const evaluation = new weave.Evaluation({
  dataset: yourDataset,
  scorers: [
    jsonStructureScorer, // Existing scorers
    yourScorer, // Your new scorer
    createYourLLMJudgeScorer(openaiClient), // LLM judge if applicable
  ],
});
```

### Scorer Best Practices

1. **Always wrap with `weave.op()`** - Enables Weave tracking and observability
2. **Return 0-1 scores** - Normalize all scores to [0, 1] range for consistency
3. **Handle errors gracefully** - Return `{ score: 0, error: "message" }` rather than throwing
4. **Make deterministic scorers pure** - No side effects, same input = same output
5. **Use factories for LLM judges** - Accept OpenAI client as parameter for testability
6. **Include reasoning** - Especially for LLM judges, include explanations
7. **Test thoroughly** - Unit test all edge cases and error conditions

## Integrating EvaluationModel into OpenAI Calls

The `createEvaluationModel` factory function standardizes how evaluation models call OpenAI and integrate with Weave.

### Basic Usage

```typescript
import weave from "weave";
import OpenAI from "openai";
import { createEvaluationModel } from "@common/evaluations";

// Initialize and wrap OpenAI client for Weave tracking
const openaiClient = weave.wrapOpenAI(new OpenAI());

// Create evaluation model with typed inputs/outputs
const myEvaluationModel = createEvaluationModel<
  MyDatasetRow, // Input type
  MyModelOutput // Output type
>(
  openaiClient, // Wrapped OpenAI client
  "gpt-4o-mini", // Model to use
  userPrompt, // User prompt (can include template variables)
  systemPrompt, // System prompt
);

// Use in Weave evaluation
const evaluation = new weave.Evaluation({
  dataset: myDataset,
  scorers: [myScorer1, myScorer2],
});

const results = await evaluation.evaluate({ model: myEvaluationModel });
```

### Prompt Templates

Prompts can include template variables that are automatically hydrated from dataset row properties:

```typescript
// User prompt with template variables
const userPrompt = `Extract claims from this comment:

Comment: \${comment}

Available Topics and Subtopics:
\${taxonomy}

Return JSON with structure: {"claims": [{"claim": "...", "quote": "...", "topicName": "...", "subtopicName": "..."}]}`;

// System prompt
const systemPrompt = `You are an expert at extracting claims from text and aligning them with a given taxonomy.`;

// Dataset row
const datasetRow = {
  comment: "I love cats, they are the best pets!",
  taxonomy: {
    topics: [{ name: "Pets", subtopics: [{ name: "Cats" }, { name: "Dogs" }] }],
  },
};

// The model will receive:
// User: "Extract claims from this comment:
//
// Comment: I love cats, they are the best pets!
//
// Available Topics and Subtopics:
// {"topics":[{"name":"Pets","subtopics":[{"name":"Cats"},{"name":"Dogs"}]}]}"
```

### How It Works Internally

The `createEvaluationModel` function:

1. **Hydrates prompts** - Replaces `${variableName}` with values from dataset row

   ```typescript
   const hydratedPrompt = hydratePromptLiterals(userPrompt, datasetRow);
   ```

2. **Calls OpenAI** - Makes structured JSON API call

   ```typescript
   const response = await openaiClient.chat.completions.create({
     model: "gpt-4o-mini",
     messages: [
       { role: "system", content: systemPrompt },
       { role: "user", content: hydratedPrompt },
     ],
     response_format: { type: "json_object" }, // Forces JSON output
   });
   ```

3. **Parses and returns** - Extracts and parses JSON response

   ```typescript
   const result = response.choices[0].message.content;
   return JSON.parse(result) as ModelOutput;
   ```

4. **Tracks with Weave** - Entire function is wrapped with `weave.op()` for observability

### Using in Production Pipelines

You can use `createEvaluationModel` in production to get LLM outputs immediately while running evaluations asynchronously on logged data.

#### Production Code (Fast Path - No Evaluation Overhead)

```typescript
// production-pipeline.ts
import weave from "weave";
import OpenAI from "openai";
import { createEvaluationModel } from "@common/evaluations";

// Initialize Weave once at startup
await weave.init("production-pipeline");
const openaiClient = weave.wrapOpenAI(new OpenAI());

// Create your evaluation model
export const myPipelineModel = createEvaluationModel<InputType, OutputType>(
  openaiClient,
  "gpt-4o-mini",
  userPrompt,
  systemPrompt,
);

// Use in pipeline - call it directly to get output
export async function runPipeline(input: InputType) {
  // Get LLM output (tracked by Weave automatically)
  const output = await myPipelineModel(input);

  // Continue with pipeline - no evaluation overhead
  const nextStepOutput = await processNextStep(output);

  return nextStepOutput;
}
```

#### Async Evaluation (Runs Separately on Logged Data)

```typescript
// evaluate-production.ts
import weave from "weave";
import { myPipelineModel } from "./production-pipeline";
import { yourScorer1, yourScorer2 } from "./scorers";

async function evaluateProductionCalls() {
  await weave.init("production-pipeline");

  // Create dataset from production calls
  // You can sample recent calls or use a curated set
  const productionDataset = new weave.Dataset({
    name: "production-sample",
    rows: [
      // Sample production inputs
      {
        /* input 1 */
      },
      {
        /* input 2 */
      },
      // ... more examples
    ],
  });

  // Create evaluation with your scorers
  const evaluation = new weave.Evaluation({
    dataset: productionDataset,
    scorers: [yourScorer1, yourScorer2],
  });

  // Run evaluation asynchronously
  const results = await evaluation.evaluate({ model: myPipelineModel });
  console.log("Production evaluation results:", results);
}

// Run on demand, scheduled (e.g., hourly), or triggered by events
evaluateProductionCalls();
```

This approach provides:

- **Fast production pipeline**: No evaluation overhead in critical path
- **Immediate LLM outputs**: Use directly in your pipeline
- **Full Weave tracking**: All calls logged for observability
- **Async evaluation**: Run scorers on logged data whenever needed
- **Flexible scoring**: Scorers that don't require specific inputs can score any logged call

## Directory Structure

```
evaluations/
├── index.ts                    # Core evaluation model factory (createEvaluationModel)
├── pipeline-evaluate.ts        # Main CLI entry point for running evaluations
├── constants.ts                # Shared constants (EVAL_MODEL = "gpt-4o-mini")
│
├── clustering/                 # Topic/subtopic taxonomy generation evaluations
│   ├── types.ts               # ClusteringDatasetRow, ClusteringModelOutput, scorer types
│   ├── model.ts               # runClusteringEvaluation() - evaluation runner
│   ├── scorers.ts             # JSON structure, topic coverage, LLM judge scorers
│   ├── datasets.ts            # Test cases with sample comments
│   └── __tests__/
│       ├── scorers.test.ts           # Unit tests for scorers
│       └── model.integration.test.ts # Integration tests with Weave
│
├── extraction/                 # Claim extraction from comments evaluations
│   ├── types.ts               # ExtractionDatasetRow, ExtractionModelOutput, scorer types
│   ├── model.ts               # runExtractionEvaluation() - evaluation runner
│   ├── scorers.ts             # JSON structure, claim quality, taxonomy alignment, quote relevance, LLM judge
│   ├── datasets.ts            # Test cases with sample comments and taxonomies
│   └── __tests__/
│       ├── scorers.test.ts           # Unit tests for scorers
│       └── model.integration.test.ts # Integration tests with Weave
│
├── deduplication/              # Claim grouping/consolidation evaluations
│   ├── types.ts               # DeduplicationDatasetRow, DeduplicationModelOutput, scorer types
│   ├── model.ts               # runDeduplicationEvaluation() - evaluation runner
│   ├── scorers.ts             # JSON structure, claim coverage, consolidation, group quality, LLM judge
│   ├── datasets.ts            # Test cases with sample claims
│   └── __tests__/
│       ├── scorers.test.ts           # Unit tests for scorers
│       └── model.integration.test.ts # Integration tests with Weave
│
├── summaries/                  # Topic/subtopic summary generation evaluations
│   ├── types.ts               # SummariesDatasetRow, SummariesModelOutput, scorer types
│   ├── model.ts               # runSummariesEvaluation() - evaluation runner
│   ├── scorers.ts             # JSON structure, length, content quality, topic coverage, LLM judge
│   ├── datasets.ts            # Test cases with topics and claims
│   └── __tests__/
│       ├── scorers.test.ts           # Unit tests for scorers
│       └── model.integration.test.ts # Integration tests with Weave
│
└── crux/                       # Disagreement analysis (crux finding) evaluations
    ├── types.ts               # CruxDatasetRow, CruxModelOutput, scorer types
    ├── model.ts               # runCruxEvaluation() - evaluation runner
    ├── scorers.ts             # JSON structure, explanation quality, LLM judge
    ├── datasets.ts            # Test cases with participant claims
    └── __tests__/
        ├── scorers.test.ts           # Unit tests for scorers
        └── model.integration.test.ts # Integration tests with Weave
```

### File Descriptions

#### Root Files

- **`index.ts`**: Core factory function `createEvaluationModel<DatasetRow, ModelOutput>()` that creates Weave-wrapped evaluation models with OpenAI integration
- **`pipeline-evaluate.ts`**: Main CLI script that runs evaluations based on command-line arguments (clustering, extraction, deduplication, summaries, crux, or all)
- **`constants.ts`**: Shared constants across evaluations (currently `EVAL_MODEL = "gpt-4o-mini"`)

#### Per-Evaluation Type Files

Each evaluation type (clustering, extraction, deduplication, summaries, crux) follows the same structure:

- **`types.ts`**: TypeScript type definitions

  - `XDatasetRow`: Input type for evaluation model
  - `XModelOutput`: Output type from evaluation model
  - `XScorerInput`: Input type for scorers (DatasetRow and ModelOutput)
  - Scorer output types for each scorer

- **`model.ts`**: Evaluation runner

  - `runXEvaluation()`: Main function that initializes Weave, creates model, creates scorers, and runs evaluation
  - Exports configured evaluation model for use in other contexts

- **`scorers.ts`**: Scorer implementations

  - `jsonStructureScorer`: Validates output conforms to expected schema
  - Domain-specific deterministic scorers (e.g., `claimQualityScorer`, `taxonomyAlignmentScorer`)
  - `createLLMJudgeScorer()`: Factory function for LLM-based evaluation

- **`datasets.ts`**: Test cases and datasets

  - Array of typed dataset rows for evaluation
  - Includes expected outputs for validation
  - Real-world examples and edge cases

- **`__tests__/scorers.test.ts`**: Unit tests

  - Tests individual scorers in isolation
  - Mocks Weave operations
  - Fast execution

- **`__tests__/model.integration.test.ts`**: Integration tests
  - Tests end-to-end evaluation flow
  - Makes real OpenAI/Weave calls
  - Skipped by default (enable with `INTEGRATION_TESTS=true`)

## Key Dependencies

From `common/package.json`:

- **`openai`** (^4.104.0): OpenAI API client for LLM calls
- **`weave`** (^0.9.3): Weights & Biases Weave for LLM evaluation and observability
- **`vitest`** (^3.1.2): Testing framework for unit and integration tests
- **`tsx`** (^4.20.6): TypeScript execution for running evaluation scripts
- **`pino`** (^9.9.0): Logging library

## Architecture Principles

1. **Type Safety**: Strong TypeScript typing throughout with generic evaluation model factory

2. **Separation of Concerns**: Clear boundaries between models, scorers, datasets, and tests

3. **Weave Integration**: All operations wrapped as Weave ops for tracking, versioning, and evaluation UI

4. **Consistent Structure**: Each evaluation type follows the same file/folder structure

5. **Testability**: Pure deterministic scorers, factory pattern for LLM judges, separate unit and integration tests

6. **Reusability**: Shared `createEvaluationModel` factory, consistent scorer patterns, typed interfaces

## Example: Creating a New Evaluation Type

To add a new evaluation type (e.g., "sentiment"):

1. **Create directory structure**:

   ```bash
   mkdir -p evaluations/sentiment/__tests__
   touch evaluations/sentiment/types.ts
   touch evaluations/sentiment/model.ts
   touch evaluations/sentiment/scorers.ts
   touch evaluations/sentiment/datasets.ts
   touch evaluations/sentiment/__tests__/scorers.test.ts
   touch evaluations/sentiment/__tests__/model.integration.test.ts
   ```

2. **Define types** (`types.ts`):

   ```typescript
   export type SentimentDatasetRow = {
     text: string;
     expectedSentiment?: "positive" | "negative" | "neutral";
   };

   export type SentimentModelOutput = {
     sentiment: "positive" | "negative" | "neutral";
     confidence: number;
   };

   export type SentimentScorerInput = {
     modelOutput: SentimentModelOutput;
     datasetRow: SentimentDatasetRow;
   };
   ```

3. **Implement scorers** (`scorers.ts`)

4. **Create datasets** (`datasets.ts`)

5. **Implement evaluation runner** (`model.ts`)

6. **Add tests** (`__tests__/`)

7. **Register in CLI** (`pipeline-evaluate.ts`):

   ```typescript
   case "sentiment":
     await runSentimentEvaluation();
     break;
   ```

8. **Add npm script** (`common/package.json`):
   ```json
   "eval:sentiment": "npx tsx evaluations/pipeline-evaluate.ts sentiment"
   ```

## Resources

- [Weights & Biases Weave Documentation](https://wandb.ai/site/weave)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Vitest Documentation](https://vitest.dev/)
- Project Weave Dashboard: "t3c-pipeline-evaluation"
