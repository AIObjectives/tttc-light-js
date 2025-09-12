import * as schema from "tttc-common/schema";
import { Env } from "../types/context";
import { createStorage } from "../storage";
import { Job } from "bullmq";
import * as apiPyserver from "tttc-common/apiPyserver";
import { logger } from "tttc-common/logger";
import {
  Result,
  failure,
  flatMapResultAsync,
  mapResult,
  sequenceResult,
  success,
} from "tttc-common/functional-utils";
import { CustomError } from "../error";
import * as Pyserver from "../pipeline/";
import { randomUUID } from "crypto";
import { llmPipelineToSchema } from "tttc-common/morphisms";
import * as Firebase from "../Firebase";
import * as api from "tttc-common/api";
import { getAnalytics } from "tttc-common/analytics";

const pipelineLogger = logger.child({ module: "pipeline" });

type FirebaseDetails = {
  reportDataUri: string;
  userId: string;
  firebaseJobId: string;
  reportId?: string; // Stable report ID for URL persistence (optional for backward compatibility)
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
  options: {
    cruxes: boolean;
  };
}

interface ReportDetails {
  title: string;
  description: string;
  question: string;
  filename: string;
}

export interface PipelineJob {
  config: PipelineConfig;
  data: schema.SourceRow[];
  reportDetails: ReportDetails;
}

type PipelineComment = apiPyserver.PipelineComment;

type PipelineErrors =
  | Pyserver.FetchError
  | Pyserver.InvalidResponseDataError
  | Pyserver.TimeoutError;

export async function pipelineJob(job: Job<PipelineJob>) {
  const jobdata = job.data;
  const { data, config, reportDetails } = jobdata;
  const { env } = config;
  const { title, description, question, filename } = reportDetails;

  // Get analytics client
  const analytics = getAnalytics();

  // Calculate data size once for all analytics (simple and accurate)
  // TODO: Consider performance optimization for very large datasets (10k+ rows)
  // JSON.stringify can block main thread for 100-500ms on large reports
  const numRows = data.length;
  const actualDataSize = JSON.stringify(data).length;

  pipelineLogger.info(
    {
      jobId: job.id,
      reportId: config.firebaseDetails?.reportId,
      actualDataSize,
      numRows,
      filename,
    },
    "Pipeline job started",
  );

  // Collect analytics data - will be sent in batch at end to avoid blocking
  const analyticsData: Record<string, any> = {
    userId: config.firebaseDetails.userId,
    job_id: job.id,
    report_id: config.firebaseDetails?.reportId,
    actual_data_size_bytes: actualDataSize,
    num_rows: numRows,
    model: config.llm.model,
    has_cruxes: config.options.cruxes,
    started_at: Date.now(),
  };

  // Create our storage object for storing the pipeline's output json
  const storage = createStorage(env);

  // Do each of the steps in the pipeline
  // This returns the results of each of the steps.
  pipelineLogger.info({ jobId: job.id }, "Starting pipeline steps");
  const pipelineStart = Date.now();
  const { topicTreeStep, claimsStep, sortedStep, addonsStep } =
    await doPipelineSteps(job);
  const pipelineEnd = Date.now();
  const pipelineDuration = pipelineEnd - pipelineStart;
  const processingRate = Math.round((numRows / pipelineDuration) * 1000);
  const dataEfficiency = Math.round(actualDataSize / numRows);

  pipelineLogger.info(
    {
      jobId: job.id,
      duration: pipelineDuration,
      stepsCompleted: {
        topicTree: topicTreeStep.tag === "success",
        claims: claimsStep.tag === "success",
        sorted: sortedStep.tag === "success",
        addons: addonsStep.tag === "success",
      },
      analytics: {
        processingRateRowsPerSecond: processingRate,
        dataEfficiency: dataEfficiency, // bytes per row
      },
    },
    "Pipeline steps completed",
  );

  // Add pipeline performance data to analytics batch
  analyticsData.pipeline_duration_ms = pipelineDuration;
  analyticsData.processing_rate_rows_per_sec = processingRate;
  analyticsData.data_efficiency_bytes_per_row = dataEfficiency;
  analyticsData.steps_success = {
    topic_tree: topicTreeStep.tag === "success",
    claims: claimsStep.tag === "success",
    sorted: sortedStep.tag === "success",
    addons: addonsStep.tag === "success",
  };

  // Summarizes all of the Usage objects into a single tracker object.
  // As of right now, it will skip over the failed steps and summarize only the success
  const tracker = summarizeUsage([topicTreeStep, claimsStep, sortedStep]);
  logTokensInTracker(tracker, "Total output");

  // Unpack the data from each of the steps
  const topicData = mapResult(topicTreeStep, (t) => t.data);
  const claimsData = mapResult(claimsStep, (c) => c.data);
  const sortData = mapResult(sortedStep, (s) => s.data);

  // Goes from Result<Step, Errors>[] -> Result<Step[], Errors>
  const outputData = sequenceResult([topicData, claimsData, sortData] as const);

  // We need to take the data we made from the pipeline steps and format it into
  // the Taxonomy object
  const newTaxonomyResult = mapResult(
    outputData,
    ([topicData, _, sortData]) => {
      const newTax: schema.Taxonomy = topicData.tree.taxonomy.map((t) => ({
        ...t,
        topicId: randomUUID(),
        subtopics: t.subtopics.map((sub) => ({
          ...sub,
          subtopicId: randomUUID(),
          // @ts-ignore // TODO FIX THIS
          claims: sortData
            .find(([tag]) => tag === t.topicName)[1]
            .topics?.find(([key]) => key === sub.subtopicName)[1]
            .claims.map((clm) => ({
              ...clm,
              claimId: randomUUID(),
              duplicates: clm.duplicates.map((dup) => ({
                ...dup,
                claimId: randomUUID(),
              })),
            })) as schema.LLMClaim[],
        })),
      }));
      return newTax;
    },
  );

  const end = Date.now();
  const secs = (end - tracker.start) / 1000;
  const finalTracker: schema.Tracker = {
    ...tracker,
    end,
    duration:
      secs > 60
        ? `${Math.floor(secs / 60)} minutes ${secs % 60} seconds`
        : `${secs} seconds`,
  };

  pipelineLogger.info(
    { duration: finalTracker.duration },
    "Pipeline completed",
  );

  // The pipeline is set to output this schema.LLMPipelineOutput function, so
  // take our data and form the output object
  const outputResult = mapResult(
    sequenceResult([
      newTaxonomyResult,
      success(data),
      success(finalTracker),
      addonsStep,
    ] as const),
    ([tree, data, tracker, addonsStep]): schema.LLMPipelineOutput => ({
      ...tracker,
      ...config.instructions,
      tree,
      data,
      addOns: {
        cruxClaims: addonsStep?.cruxClaims,
        topCruxes: addonsStep?.topCruxes,
        controversyMatrix: addonsStep?.controversyMatrix,
      },
      question: question,
      title: title,
      description: description,
      batchSize: 0, // I think this is deprecated? Leaving at 0 for now.
    }),
  );

  // Take the pipeline object and translate it into our updated schema
  const finalResult = mapResult(outputResult, llmPipelineToSchema);

  if (finalResult.tag === "success") {
    // add the json data to storage
    const resultValue = finalResult.value;
    const resultValueJson = JSON.stringify(resultValue); // Calculate once
    const reportJsonSize = resultValueJson.length;
    pipelineLogger.info(
      {
        jobId: job.id,
        reportJsonSize,
        filename,
      },
      "Saving final report to storage",
    );

    const saveResult = await storage.save(
      filename,
      resultValueJson, // Reuse the already stringified JSON
    );

    if (saveResult.tag === "failure") {
      pipelineLogger.error(
        {
          jobId: job.id,
          error: saveResult.error,
          filename,
          reportJsonSize,
        },
        "Failed to save final report",
      );
      throw new Error(
        `Failed to save final report: ${saveResult.error.message}`,
      );
    }

    const outputExpansionFactor =
      Math.round((reportJsonSize / actualDataSize) * 100) / 100;
    const sizeEfficiencyBytesPerRow = Math.round(reportJsonSize / numRows);

    pipelineLogger.info(
      {
        jobId: job.id,
        savedUrl: saveResult.value,
        reportJsonSize,
        analytics: {
          outputExpansionFactor,
          sizeEfficiencyBytesPerRow,
        },
      },
      "Final report saved successfully",
    );

    // Add completion data to analytics batch and send once
    analyticsData.status = "completed";
    analyticsData.total_duration_ms = Date.now() - analyticsData.started_at;
    analyticsData.output_size_bytes = reportJsonSize;
    analyticsData.output_expansion_factor = outputExpansionFactor;
    analyticsData.size_efficiency_bytes_per_row = sizeEfficiencyBytesPerRow;
    analyticsData.total_prompt_tokens = finalTracker.prompt_tokens;
    analyticsData.total_completion_tokens = finalTracker.completion_tokens;
    analyticsData.total_tokens = finalTracker.total_tokens;
    analyticsData.total_cost = finalTracker.costs;

    // Send consolidated analytics in single deferred call
    setImmediate(() => {
      analytics?.track({
        name: "report_completed",
        properties: analyticsData,
      });
    });

    // Add the job ref to Firebase using stable report ID
    const resultData = resultValue.data;
    const { topics, sources, date } = resultData[1];
    const { firebaseDetails } = config;

    // Update existing ReportRef document with final statistics
    const reportId = firebaseDetails.reportId || firebaseDetails.firebaseJobId;

    // Update reportDataUri to point to the final report file
    const finalReportUri = saveResult.value;
    await Firebase.updateReportRefDataUri(reportId, finalReportUri);

    await Firebase.updateReportRefWithStats(
      reportId,
      firebaseDetails.firebaseJobId,
      {
        title,
        description: description,
        numTopics: topics.length,
        numSubtopics: topics.flatMap((t) => t.subtopics).length,
        numClaims: topics.flatMap((t) => t.subtopics.flatMap((s) => s.claims))
          .length,
        numPeople: new Set(sources.map((s) => s.interview)).size,
        createdDate: new Date(date),
      },
    );
    pipelineLogger.info("Finished report");
    await job.updateProgress({
      status: api.reportJobStatus.Values.finished,
    });
  } else {
    const err = finalResult.error;

    pipelineLogger.error(
      {
        error: err,
        errorName: err.name,
        errorMessage: err.message,
      },
      "Pipeline error occurred",
    );

    // Add failure data to analytics batch and send once
    analyticsData.status = "failed";
    analyticsData.error_name = err.name;
    analyticsData.error_message = err.message;
    analyticsData.failed_at_stage = "final_processing";
    analyticsData.total_duration_ms = Date.now() - analyticsData.started_at;

    // Send consolidated failure analytics in single deferred call
    setImmediate(() => {
      analytics?.track({
        name: "report_failed",
        properties: analyticsData,
      });
    });

    // We can handle specific errors here if we want.
    throw err;
  }
}

/**
 * Does each of the steps in the pyserver pipeline
 */
async function doPipelineSteps(job: Job<PipelineJob>) {
  const { config, data } = job.data;
  const { doClaimsStep, doSortClaimsTreeStep, doTopicTreeStep, doAddons } =
    makePyserverFuncs(config);

  const pipelineComments: Result<
    PipelineComment[],
    MissingInterviewAttributionsError
  > = makePipelineComments(data);

  // Update job progress
  pipelineLogger.info(
    {
      jobId: job.id,
      numComments:
        pipelineComments.tag === "success" ? pipelineComments.value.length : 0,
    },
    "Step 1: generating taxonomy of topics and subtopics",
  );
  await job.updateProgress({
    status: api.reportJobStatus.Values.clustering,
  });

  // do topic tree step
  const stepStart = Date.now();
  const topicTreeStep: PyserverResult<
    ClaimStepProps,
    PipelineErrors | MissingInterviewAttributionsError
  > = await flatMapResultAsync(pipelineComments, doTopicTreeStep);

  if (topicTreeStep.tag === "failure") {
    pipelineLogger.error(
      {
        jobId: job.id,
        error: topicTreeStep.error,
        errorName: topicTreeStep.error.name,
        errorMessage: topicTreeStep.error.message,
        duration: Date.now() - stepStart,
      },
      "Topic tree step failed",
    );
  } else {
    pipelineLogger.info(
      {
        jobId: job.id,
        duration: Date.now() - stepStart,
        numTopics: topicTreeStep.value.data.tree.taxonomy.length,
      },
      "Topic tree step completed successfully",
    );
  }

  // update job progress
  pipelineLogger.info(
    "Step 2: extracting claims matching the topics and subtopics",
  );
  await job.updateProgress({
    status: api.reportJobStatus.Values.extraction,
  });

  // do claims step
  const claimsStep: PyserverResult<
    SortClaimsProps,
    PipelineErrors | MissingInterviewAttributionsError
  > = await flatMapResultAsync(topicTreeStep, (val) => doClaimsStep(val.data));

  // update job progress
  pipelineLogger.info("Step 3: cleaning and sorting the taxonomy");
  await job.updateProgress({
    status: api.reportJobStatus.Values.sorting,
  });

  // do sort step
  const sortedStep: PyserverResult<
    OutputProps,
    PipelineErrors | MissingInterviewAttributionsError
  > = await flatMapResultAsync(claimsStep, (val) =>
    doSortClaimsTreeStep(val.data),
  );

  pipelineLogger.info("Doing optional addons step");
  const addonsStep = await flatMapResultAsync(
    sequenceResult([claimsStep, topicTreeStep] as const),
    async ([claim, topic]) => {
      return await doAddons(
        config.options.cruxes
          ? {
              crux: {
                topics: topic.data.tree.taxonomy,
                // ! does this ever change?
                top_k: 10,
                crux_tree: claim.data.tree,
              },
            }
          : {},
      );
    },
  );
  pipelineLogger.debug(
    {
      addonsStep: addonsStep.tag === "success" ? "success" : "failure",
      cruxesEnabled: config.options.cruxes,
    },
    "Cruxes step completed",
  );
  // update job progress
  pipelineLogger.info("Step 4: wrapping up");
  await job.updateProgress({
    status: api.reportJobStatus.Values.wrappingup,
  });

  return { topicTreeStep, claimsStep, sortedStep, addonsStep };
}

/**
 * Props that the pyserver takes for the claims step
 */
type ClaimStepProps = {
  tree: {
    taxonomy: apiPyserver.PartialTopic[];
  };
  comments: apiPyserver.PipelineComment[];
};

/**
 * Props that the pyserver takes for the sort step
 */
type SortClaimsProps = {
  tree: apiPyserver.ClaimsTree;
  sort: string;
};

/**
 * Output of the sort claims response
 */
type OutputProps = apiPyserver.SortClaimsTreeResponse["data"];

/**
 * Generic type for the type of information sent back from the pyserver.
 *
 * Also appends a stepName string that's used for logging
 */
type PyserverReply<T> = {
  stepName: string;
  data: T;
  usage: apiPyserver.Usage;
  cost: number;
};

type PyserverResult<T, E> = Result<PyserverReply<T>, E>;

/**
 * The pyserver's responses aren't exact a 1:1 to the next steps inputs, so we need to reshape them slightly.
 *
 * Also includes a stepName that's used for logging
 */
const PipelineOutputToProps = {
  makeClaimsProps: (
    reply: apiPyserver.TopicTreeResponse,
    comments: PipelineComment[],
  ) => {
    return {
      ...reply,
      stepName: "Topic Tree Step",
      data: {
        tree: {
          taxonomy: reply.data,
        },
        comments,
      },
    };
  },
  makeSortedProps: (reply: apiPyserver.ClaimsReply) => {
    return {
      ...reply,
      stepName: "Claims Step",
      data: {
        tree: reply.data,
        sort: "numPeople",
      },
    };
  },
  makeOutputProps: (reply: apiPyserver.SortClaimsTreeResponse) => {
    return {
      ...reply,
      stepName: "Sort Step",
    };
  },
};

/**
 * This builds each of the step functions called in doPipelineSteps
 */
const makePyserverFuncs = (config: PipelineConfig) => {
  const { instructions, llm, api_key, env } = config;
  // Make each config object for each call
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

  /**
   * Calls the topic tree step on the pyserver, and then reshapes the response to the next step's props
   */
  const doTopicTreeStep = async (comments: apiPyserver.PipelineComment[]) =>
    await Pyserver.topicTreePipelineStep(env, {
      comments,
      llm: topicTreeLLMConfig,
    }).then((val) =>
      mapResult(val, (arg) =>
        PipelineOutputToProps.makeClaimsProps(arg, comments),
      ),
    );

  /**
   * Calls the claims step on the pyserver, and then reshapes the response to the next step's props
   */
  const doClaimsStep = async (args: {
    tree: { taxonomy: apiPyserver.PartialTopic[] };
    comments: apiPyserver.PipelineComment[];
  }) =>
    await Pyserver.claimsPipelineStep(env, {
      ...args,
      llm: claimsLLMConfig,
    }).then((val) =>
      mapResult(val, (reply) => PipelineOutputToProps.makeSortedProps(reply)),
    );

  type CruxProps = {
    topics: apiPyserver.PartialTopic[];
    crux_tree: apiPyserver.ClaimsTree;
    top_k: number;
  };
  const doCruxStep = async (args: CruxProps) =>
    await Pyserver.cruxesPipelineStep(env, { ...args, llm: cruxesLLMConfig });

  type Addons = Partial<{
    crux: CruxProps;
  }>;

  const doAddons = async (addons: Addons) => {
    // keep it simple for now, since we really only have one addon

    if (!addons.crux) {
      return success(null);
    } else {
      return await doCruxStep(addons.crux);
    }
  };

  /**
   * Calls the sort step on the pyserver
   */
  const doSortClaimsTreeStep = async (arg: {
    tree: apiPyserver.ClaimsTree;
    sort: string;
  }) =>
    await Pyserver.sortClaimsTreePipelineStep(env, {
      ...arg,
      llm: dedupLLMConfig,
    }).then((val) =>
      mapResult(val, (arg) => PipelineOutputToProps.makeOutputProps(arg)),
    );

  return {
    doTopicTreeStep,
    doClaimsStep,
    doAddons,
    doSortClaimsTreeStep,
  };
};

/**
 * The pyserver accepts comments in a different format - this ensures that everything is correct
 */
const makePipelineComments = (
  comments: schema.SourceRow[],
): Result<apiPyserver.PipelineComment[], MissingInterviewAttributionsError> => {
  const anonNamesAreAdded = comments.every((c) => c.interview);
  if (!anonNamesAreAdded) {
    return failure(
      new MissingInterviewAttributionsError(
        "Missing interview fields should be filled in before being added to pipeline",
      ),
    );
  }
  const pipelineComments: PipelineComment[] = comments.map((c) => ({
    id: c.id,
    speaker: c.interview!,
    text: c.comment,
  }));
  return success(pipelineComments);
};

const logTokensInTracker = (tracker: schema.Tracker, stepName: string) => {
  pipelineLogger.info(
    {
      stepName,
      costs: tracker.costs,
      promptTokens: tracker.prompt_tokens,
      completionTokens: tracker.completion_tokens,
    },
    "Step token usage",
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
      logTokensInTracker(updatedTracker, step.value.stepName);
      return updatedTracker;
    } else {
      return accum;
    }
  }, initTracker);
}

class MissingInterviewAttributionsError extends CustomError<"MissingInterviewAttributions"> {
  constructor(err?: unknown) {
    super("MissingInterviewAttributions", err);
  }
}
