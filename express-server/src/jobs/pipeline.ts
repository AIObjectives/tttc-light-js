import * as schema from "tttc-common/schema";
import { Env } from "../types/context";
import { createStorage } from "../storage";
import { Job } from "bullmq";
import * as apiPyserver from "tttc-common/apiPyserver";
import { topicTreePipelineStep } from "../pipeline/topicTreeStep";
import { claimsPipelineStep } from "../pipeline/claimsStep";
import { cruxesPipelineStep } from "../pipeline/cruxesStep";
import { sortClaimsTreePipelineStep } from "../pipeline/sortClaimsTree";
import { Result, flatMapResultAsync, mapResult } from "../types/result";
import { CustomError } from "src/error";

type FirebaseDetails = {
  reportDataUri: string;
  userId: string;
  firebaseJobId: string;
};

interface LLM {
  model: string;
}

interface Instructions {
  systemInstructions: string;
  clusteringInstructions: string;
  extractionInstructions: string;
  dedupInstructions: string;
  cruxInstructions: string;
}

interface PipelineConfig {
  env: Env;
  auth: "public" | "private";
  firebaseDetails: FirebaseDetails;
  llm: LLM;
  instructions: Instructions;
  api_key: string;
  featureFlags: {
    cruxes: boolean;
  };
}

interface PipelineJob {
  config: PipelineConfig;
  data: schema.Source[];
  filename: string;
}

export async function pipelineJob(job: Job<PipelineJob>) {
  const jobdata = job.data;
  const { data, config } = jobdata;
  const { auth, env } = config;
  const storage = createStorage(env, auth);

  const { doClaimsStep, doCruxStep, doSortClaimsTreeStep, doTopicTreeStep } =
    makePyserverFuncs(config);

  console.log("Step 1: generating taxonomy of topics and subtopics");

  const pipelineComments = makePipelineComments(data);

  const topicTreeStep = await flatMapResultAsync(
    pipelineComments,
    doTopicTreeStep,
  );

  const claimsStep = await flatMapResultAsync(topicTreeStep, (val) =>
    doClaimsStep(val.data),
  );

  // const cruxesStep = config.featureFlags.cruxes ? await flatMapResultAsync(claimsStep, (val) => doCruxStep(val.data)) : claimsStep

  const sortedStep = await flatMapResultAsync(claimsStep, (val) =>
    doSortClaimsTreeStep(val.data),
  );

  const tracker = summarizeUsage([topicTreeStep, claimsStep, sortedStep]);
}

type ClaimStepProps = {
  tree: {
    taxonomy: apiPyserver.PartialTopic[];
  };
  comments: apiPyserver.PipelineComment[];
};

type CruxStepProps = {
  topics: apiPyserver.PartialTopic[];
  crux_tree: apiPyserver.ClaimsTree;
  top_k: number;
};

type SortClaimsProps = {
  tree: apiPyserver.ClaimsTree;
  sort: string;
};

interface PyserverReply<T> {
  data: T;
  usage: apiPyserver.Usage;
  cost: number;
}

function topicTreeReplyToClaimStepProps(
  reply: apiPyserver.TopicTreeResponse,
  comments: apiPyserver.PipelineComment[],
): PyserverReply<ClaimStepProps> {
  return {
    ...reply,
    data: {
      tree: {
        taxonomy: reply.data,
      },
      comments,
    },
  };
}

function claimsReplyToCruxesProps(
  reply: apiPyserver.ClaimsReply,
  topics: apiPyserver.PartialTopic[],
): PyserverReply<CruxStepProps> {
  return {
    ...reply,
    data: {
      crux_tree: reply.data,
      topics,
      top_k: 10,
    },
  };
}

function claimsReplyToSortedProps(
  reply: apiPyserver.ClaimsReply,
): PyserverReply<SortClaimsProps> {
  return {
    ...reply,
    data: {
      tree: reply.data,
      sort: "numPeople",
    },
  };
}

const makePyserverFuncs = (config: PipelineConfig) => {
  const { instructions, llm, api_key, env } = config;
  const [
    topicTreeLLMConfig,
    claimsLLMConfig,
    dedupLLMConfig,
    cruxesLLMConfig,
  ]: apiPyserver.LLMConfig[] = [
    instructions.clusteringInstructions,
    instructions.extractionInstructions,
    instructions.dedupInstructions,
    instructions.cruxInstructions,
  ].map((prompt) => ({
    system_prompt: instructions.systemInstructions,
    user_prompt: prompt,
    model_name: llm.model,
    api_key: api_key,
  }));

  const doTopicTreeStep = async (comments: apiPyserver.PipelineComment[]) =>
    await topicTreePipelineStep(env, {
      comments,
      llm: topicTreeLLMConfig,
    }).then((val) =>
      mapResult(val, (arg) => topicTreeReplyToClaimStepProps(arg, comments)),
    );

  const doClaimsStep = async (args: {
    tree: { taxonomy: apiPyserver.PartialTopic[] };
    comments: apiPyserver.PipelineComment[];
  }) =>
    await claimsPipelineStep(env, { ...args, llm: claimsLLMConfig }).then(
      (val) => mapResult(val, (reply) => claimsReplyToSortedProps(reply)),
    );

  const doCruxStep = async (args: {
    topics: apiPyserver.PartialTopic[];
    crux_tree: apiPyserver.ClaimsTree;
    top_k: number;
  }) => await cruxesPipelineStep(env, { ...args, llm: cruxesLLMConfig });

  const doSortClaimsTreeStep = async (arg: {
    tree: apiPyserver.ClaimsTree;
    sort: string;
  }) => await sortClaimsTreePipelineStep(env, { ...arg, llm: dedupLLMConfig });

  return {
    doTopicTreeStep,
    doClaimsStep,
    doCruxStep,
    doSortClaimsTreeStep,
  };
};

/**
 * The pyserver accepts comments in a different format - this ensures that everything is correct
 */
const makePipelineComments = (
  comments: schema.Source[],
): Result<apiPyserver.PipelineComment[], UnsupportedCommentTypes> => {
  /**
   * Currently there are more source types than are supported.
   */
  const allTextSources = comments.every((c) => c.data[0] === "text");
  if (!allTextSources) {
    return {
      tag: "failure",
      error: new UnsupportedCommentTypes(
        "T3C does not support creating video or audio based reports yet",
      ),
    };
  } else {
    return {
      tag: "success",
      value: comments.map((c) => ({
        id: c.id,
        speaker: c.interview,
        text: (c.data as schema.TextMediaSource)[1].text,
      })),
    };
  }
};

const logTokensInTracker = (tracker: schema.Tracker) => {
  console.log(
    `Cost:$${tracker.costs};Tok_in:${tracker.prompt_tokens};Tok_out:${tracker.completion_tokens}`,
  );
};

function sumTokensCost(run: {
  tracker: schema.Tracker;
  stepUsage: schema.UsageTokens;
  stepCost: number;
}): schema.Tracker {
  // add token counts
  const totalCost = run.tracker.costs + run.stepCost;
  const totalPromptTokens =
    run.tracker.prompt_tokens + run.stepUsage.prompt_tokens;
  const totalCompletionTokens =
    run.tracker.completion_tokens + run.stepUsage.completion_tokens;
  const totalTokens = run.tracker.total_tokens + run.stepUsage.total_tokens;

  return {
    ...run.tracker,
    costs: totalCost,
    prompt_tokens: totalPromptTokens,
    completion_tokens: totalCompletionTokens,
    total_tokens: totalTokens,
  };
}

function summarizeUsage(steps: Result<PyserverReply<unknown>, unknown>[]) {
  const initTracker: schema.Tracker = {
    costs: 0,
    start: Date.now(),
    unmatchedClaims: [],
    prompt_tokens: 0,
    total_tokens: 0,
    completion_tokens: 0,
  };
  return steps.reduce((accum, step) => {
    if (step.tag === "success") {
      const { usage, cost } = step.value;
      const updatedTracker = sumTokensCost({
        tracker: accum,
        stepUsage: usage,
        stepCost: cost,
      });
      logTokensInTracker(updatedTracker);
      return updatedTracker;
    } else {
      console.log("TODO");
      return accum;
    }
  }, initTracker);
}

// const logStep = (result:Result<unknown, unknown>, message:string):void => {
//   if (result.tag === 'success') {
//     console.log(message)
//   }
//   return;
// }

class UnsupportedCommentTypes extends CustomError<"UnsupportedCommentTypes"> {
  constructor(err?: unknown) {
    super("UnsupportedCommentTypes", err);
  }
}
