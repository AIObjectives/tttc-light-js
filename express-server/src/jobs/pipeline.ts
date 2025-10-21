import * as schema from "tttc-common/schema";
import { Env } from "../types/context";
import { createStorage } from "../storage";
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
import { getAnalytics } from "tttc-common/analytics";
import {
  initializeAuditLog,
  getAuditLog,
  deleteAuditLog,
} from "../utils/auditLogRedis";
import Redis from "ioredis";

const pipelineLogger = logger.child({ module: "pipeline" });

/**
 * Pipeline-specific status update that doesn't fail the pipeline on status update failures
 * Uses Firebase retry logic but logs and continues on final failure
 */
async function updatePipelineStatus(
  reportId: string,
  status: string,
  subState?: string,
): Promise<void> {
  try {
    // Validate status and convert to proper type
    const validatedStatus = Firebase.validateStatusValue(status);
    const options = subState ? { subState } : undefined;
    await Firebase.updateReportRefStatusWithRetry(
      reportId,
      validatedStatus,
      options,
    );
  } catch (error) {
    // Log error but don't fail pipeline - status updates are non-critical for pipeline execution
    pipelineLogger.error(
      { reportId, status, subState, error },
      "Status update failed after all retries - continuing pipeline",
    );
  }
}

/**
 * Maps a subtopic from the taxonomy to include claims and UUIDs
 * Handles cases where no claims were extracted for a subtopic
 */
function mapSubtopicWithClaims(
  sub: { subtopicName: string; subtopicShortDescription: string },
  topicName: string,
  sortData: apiPyserver.SortClaimsTreeResponse["data"],
): schema.LLMSubtopic {
  // Find the topic in sortData
  const topicEntry = sortData.find(([tag]) => tag === topicName);
  if (!topicEntry) {
    pipelineLogger.error(
      {
        topicName,
        availableTopics: sortData.map(([tag]) => tag),
      },
      "Topic not found in sortData",
    );
    throw new Error(`Topic "${topicName}" not found in sortData`);
  }

  // Find the subtopic within the topic (exact match only - structured outputs guarantee exact names)
  const subtopicEntry = topicEntry[1].topics?.find(
    ([key]) => key === sub.subtopicName,
  );

  // If no match, handle as empty subtopic (no claims extracted for this category)
  if (!subtopicEntry) {
    pipelineLogger.warn(
      {
        topicName,
        subtopicName: sub.subtopicName,
        availableSubtopics: topicEntry[1].topics?.map(([key]) => key) || [],
      },
      "Subtopic not found in sortData - creating empty subtopic (no claims extracted for this category)",
    );

    // Return subtopic with empty claims array
    // This happens when taxonomy includes a subtopic but LLM didn't extract any claims for it
    return {
      ...sub,
      subtopicId: randomUUID(),
      claims: [] as schema.LLMClaim[],
    };
  }

  return {
    ...sub,
    subtopicId: randomUUID(),
    claims: subtopicEntry[1].claims.map((clm) => ({
      ...clm,
      claimId: randomUUID(),
      duplicates: clm.duplicates.map((dup) => ({
        ...dup,
        claimId: randomUUID(),
      })),
    })) as schema.LLMClaim[],
  };
}

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
  summariesInstructions: string;
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

export async function pipelineJob(job: PipelineJob) {
  const { data, config, reportDetails } = job;
  const { env } = config;
  const { title, description, question, filename } = reportDetails;

  // Get analytics client
  const analytics = getAnalytics();

  // Calculate data size once for all analytics (simple and accurate)
  // TODO: Consider performance optimization for very large datasets (10k+ rows)
  // JSON.stringify can block main thread for 100-500ms on large reports
  const numRows = data.length;
  const actualDataSize = JSON.stringify(data).length;
  const reportId = config.firebaseDetails?.reportId;

  pipelineLogger.info(
    {
      reportId: reportId,
      userId: config.firebaseDetails.userId,
      actualDataSize,
      numRows,
      filename,
    },
    "Pipeline job started",
  );

  // Collect analytics data - will be sent in batch at end to avoid blocking
  const analyticsData: Record<string, any> = {
    userId: config.firebaseDetails.userId,
    report_id: reportId,
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
  pipelineLogger.info({ reportId }, "Starting pipeline steps");
  const pipelineStart = Date.now();
  const {
    topicTreeStep,
    claimsStep,
    sortedStep,
    summariesStep,
    addonsStep,
    auditLog,
  } = await doPipelineSteps(job);
  const pipelineEnd = Date.now();
  const pipelineDuration = pipelineEnd - pipelineStart;
  const processingRate = Math.round((numRows / pipelineDuration) * 1000);
  const dataEfficiency = Math.round(actualDataSize / numRows);

  pipelineLogger.info(
    {
      reportId: reportId,
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
  const tracker = summarizeUsage([
    topicTreeStep,
    claimsStep,
    sortedStep,
    summariesStep,
  ]);
  logTokensInTracker(tracker, "Total output");

  // Unpack the data from each of the steps
  const topicData = mapResult(topicTreeStep, (t) => t.data);
  const claimsData = mapResult(claimsStep, (c) => c.data);
  const sortData = mapResult(sortedStep, (s) => s.data);
  const summariesData = mapResult(summariesStep, (s) => s.data);

  // Goes from Result<Step, Errors>[] -> Result<Step[], Errors>
  const outputData = sequenceResult([
    topicData,
    claimsData,
    sortData,
    summariesData,
  ] as const);

  // We need to take the data we made from the pipeline steps and format it into
  // the Taxonomy object
  const newTaxonomyResult = mapResult(
    outputData,
    ([topicData, _, sortData, summariesData]) => {
      // Create a map of topic names to summaries for quick lookup
      const summariesMap = new Map<string, string>();
      summariesData.forEach(
        (summary: { topicName: string; summary: string }) => {
          summariesMap.set(summary.topicName, summary.summary);
        },
      );

      const newTax: schema.Taxonomy = topicData.tree.taxonomy.map(
        (t: apiPyserver.PartialTopic) => ({
          ...t,
          topicId: randomUUID(),
          topicSummary: summariesMap.get(t.topicName), // Add the topic summary
          subtopics: t.subtopics.map((sub) =>
            mapSubtopicWithClaims(sub, t.topicName, sortData),
          ),
        }),
      );
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
  const finalResult = mapResult(outputResult, (pipelineOutput) => {
    const result = llmPipelineToSchema(pipelineOutput);
    // Add audit log if available
    if (auditLog) {
      return { ...result, auditLog };
    }
    return result;
  });

  if (finalResult.tag === "success") {
    // add the json data to storage
    const resultValue = finalResult.value;
    const resultValueJson = JSON.stringify(resultValue); // Calculate once
    const reportJsonSize = resultValueJson.length;
    pipelineLogger.info(
      {
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

    // Set ReportRef status to completed
    await updatePipelineStatus(reportId, "completed");
  } else {
    const err = finalResult.error as Error;

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
async function doPipelineSteps(job: PipelineJob) {
  const { config, data } = job;
  const reportId = config.firebaseDetails?.reportId;
  const userId = config.firebaseDetails?.userId;

  // Get Redis connection for audit log
  // TODO: Improve dependency injection by adding redis to PipelineConfig
  const redis = new Redis(config.env.REDIS_URL, {
    connectionName: "Pipeline-AuditLog",
    maxRetriesPerRequest: 3,
    connectTimeout: 10000, // 10 seconds
    commandTimeout: 5000, // 5 seconds per command
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times) => {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 100, 3000); // Exponential backoff up to 3s
    },
  });

  // Initialize audit log in Redis before pipeline starts
  const commentCount = data.length;
  if (reportId) {
    try {
      await initializeAuditLog(redis, reportId, commentCount);
      pipelineLogger.info(
        { reportId, commentCount },
        "Initialized audit log in Redis",
      );
    } catch (error) {
      pipelineLogger.error(
        { reportId, error },
        "Failed to initialize audit log in Redis",
      );
    }
  }

  const {
    doClaimsStep,
    doSortClaimsTreeStep,
    doTopicTreeStep,
    doTopicSummariesStep,
    doAddons,
  } = makePyserverFuncs(config, userId, reportId);

  const pipelineComments: Result<
    PipelineComment[],
    MissingInterviewAttributionsError
  > = makePipelineComments(data);

  // Update job progress
  pipelineLogger.info(
    {
      reportId: reportId,
      numComments:
        pipelineComments.tag === "success" ? pipelineComments.value.length : 0,
    },
    "Step 1: generating taxonomy of topics and subtopics",
  );

  // Update reportRef to keep status in sync with correct sub-state
  const reportIdForStatus =
    config.firebaseDetails.reportId || config.firebaseDetails.firebaseJobId;
  await updatePipelineStatus(reportIdForStatus, "processing", "clustering");

  // do topic tree step
  const stepStart = Date.now();
  const topicTreeStep: PyserverResult<
    ClaimStepProps,
    PipelineErrors | MissingInterviewAttributionsError
  > = await flatMapResultAsync(pipelineComments, doTopicTreeStep);

  if (topicTreeStep.tag === "failure") {
    pipelineLogger.error(
      {
        reportId: reportId,
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
        reportId: reportId,
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
  // Update reportRef to keep status in sync with correct sub-state
  await updatePipelineStatus(
    config.firebaseDetails.reportId || config.firebaseDetails.firebaseJobId,
    "processing",
    "extraction",
  );

  // do claims step
  const claimsStep: PyserverResult<
    SortClaimsProps,
    PipelineErrors | MissingInterviewAttributionsError
  > = await flatMapResultAsync(topicTreeStep, (val) => doClaimsStep(val.data));

  // update job progress
  pipelineLogger.info("Step 3: cleaning and sorting the taxonomy");
  // Update reportRef to keep status in sync with correct sub-state
  await updatePipelineStatus(
    config.firebaseDetails.reportId || config.firebaseDetails.firebaseJobId,
    "processing",
    "sorting",
  );

  // do sort step
  const sortedStep: PyserverResult<
    OutputProps,
    PipelineErrors | MissingInterviewAttributionsError
  > = await flatMapResultAsync(claimsStep, (val) =>
    doSortClaimsTreeStep(val.data),
  );

  // update job progress
  pipelineLogger.info("Step 4: generating topic summaries");
  await updatePipelineStatus(
    config.firebaseDetails.reportId || config.firebaseDetails.firebaseJobId,
    "processing",
    "summarizing",
  );

  // do topic summaries step
  const summariesStep: PyserverResult<
    TopicSummariesProps,
    PipelineErrors | MissingInterviewAttributionsError
  > = await flatMapResultAsync(sortedStep, (val) =>
    doTopicSummariesStep(val.data),
  );

  /**
   * Step 5: Optional Add-ons (Cruxes)
   *
   * Cruxes identify controversial statements that divide participants.
   * Only runs if config.options.cruxes = true (from frontend toggle).
   *
   * Input:
   * - topics: taxonomy from Step 1 (topic tree)
   * - crux_tree: sorted claims from Step 3 (with speaker attribution)
   * - top_k: Number of most controversial pairs to return (default 10)
   *
   * Process (pyserver):
   * - For each subtopic with ≥2 speakers and ≥2 claims:
   *   - Anonymize speaker names before LLM call (privacy)
   *   - LLM generates synthesized "crux claim" that splits participants
   *   - Track who agrees/disagrees with each crux
   * - Build controversy matrix scoring all crux pairs
   * - Return top K most divisive pairs
   *
   * Output (if successful): { cruxClaims[], topCruxes[], controversyMatrix[][] }
   * Output (if disabled): {} (empty object)
   *
   * Debugging:
   * - If addOns is empty {}, check: config.options.cruxes, data requirements, pyserver logs
   * - Use: node utils/check-cruxes.js <report.json>
   */
  pipelineLogger.info("Doing optional addons step");
  const addonsStep = await flatMapResultAsync(
    sequenceResult([claimsStep, topicTreeStep] as const),
    async ([claim, topic]) => {
      return await doAddons(
        config.options.cruxes
          ? {
              crux: {
                topics: topic.data.tree.taxonomy,
                top_k: 10, // Top 10 most controversial crux pairs
                crux_tree: claim.data.tree, // Sorted claims with speaker info
              },
            }
          : {},
      );
    },
  );
  // Log detailed cruxes results for debugging
  if (config.options.cruxes) {
    if (addonsStep.tag === "success") {
      const cruxCount = addonsStep.value?.cruxClaims?.length || 0;
      const topCount = addonsStep.value?.topCruxes?.length || 0;
      pipelineLogger.info(
        {
          cruxClaimsGenerated: cruxCount,
          topCruxPairs: topCount,
          hasControversyMatrix: !!addonsStep.value?.controversyMatrix,
        },
        "Cruxes generated successfully",
      );
    } else {
      pipelineLogger.error(
        {
          error: addonsStep.error,
        },
        "Cruxes step failed",
      );
    }
  } else {
    pipelineLogger.debug("Cruxes step skipped (not enabled)");
  }
  // update job progress
  pipelineLogger.info("Step 5: wrapping up");
  // Update reportRef to keep status in sync with correct sub-state
  await updatePipelineStatus(
    config.firebaseDetails.reportId || config.firebaseDetails.firebaseJobId,
    "processing",
    "wrappingup",
  );

  // Retrieve final audit log from Redis
  let finalAuditLog: schema.ProcessingAuditLog | undefined;
  if (reportId) {
    try {
      const auditLog = await getAuditLog(redis, reportId);
      if (auditLog) {
        finalAuditLog = auditLog;
        pipelineLogger.info(
          {
            reportId,
            inputCount: auditLog.inputCommentCount,
            finalCount: auditLog.finalQuoteCount,
            summary: auditLog.summary,
          },
          "Retrieved final audit log from Redis",
        );
        // Clean up Redis after retrieval
        await deleteAuditLog(redis, reportId);
      }
    } catch (error) {
      pipelineLogger.error(
        { reportId, error },
        "Failed to retrieve audit log from Redis",
      );
    }
  }

  // Close Redis connection
  redis.disconnect();

  return {
    topicTreeStep,
    claimsStep,
    sortedStep,
    summariesStep,
    addonsStep,
    auditLog: finalAuditLog,
  };
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
 * Note: we omit llm from SortClaimsTreeRequest since it's added by doSortClaimsTreeStep
 */
type SortClaimsProps = Omit<apiPyserver.SortClaimsTreeRequest, "llm">;

/**
 * Output of the sort claims response
 */
type OutputProps = apiPyserver.SortClaimsTreeResponse["data"];

/**
 * Ouput of the topic summaries repsonse
 */
type TopicSummariesProps = apiPyserver.TopicSummariesResponse["data"];

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
      usage: reply.usage,
      cost: reply.cost,
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
  makeSummariesProps: (reply: apiPyserver.TopicSummariesResponse) => {
    return {
      ...reply,
      stepName: "Summaries Step",
      data: reply.data,
    };
  },
};

/**
 * This builds each of the step functions called in doPipelineSteps
 */
const makePyserverFuncs = (
  config: PipelineConfig,
  userId?: string,
  reportId?: string,
) => {
  const { instructions, llm, api_key, env } = config;
  // Make each config object for each call
  const [
    topicTreeLLMConfig,
    claimsLLMConfig,
    dedupLLMConfig,
    summariesLLMConfig,
    cruxesLLMConfig,
  ]: apiPyserver.LLMConfig[] = [
    instructions.clusteringInstructions,
    instructions.extractionInstructions,
    instructions.dedupInstructions,
    instructions.summariesInstructions,
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
    await Pyserver.topicTreePipelineStep(
      env,
      {
        comments,
        llm: topicTreeLLMConfig,
      },
      userId,
      reportId,
    ).then((val) =>
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
  }) => {
    const result = await Pyserver.claimsPipelineStep(
      env,
      {
        ...args,
        llm: claimsLLMConfig,
      },
      userId,
      reportId,
    );

    return mapResult(result, (reply) =>
      PipelineOutputToProps.makeSortedProps(reply),
    );
  };

  type CruxProps = {
    topics: apiPyserver.PartialTopic[];
    crux_tree: apiPyserver.ClaimsTree;
    top_k: number;
  };
  const doCruxStep = async (args: CruxProps) =>
    await Pyserver.cruxesPipelineStep(
      env,
      { ...args, llm: cruxesLLMConfig },
      userId,
      reportId,
    );

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
  const doSortClaimsTreeStep = async (arg: SortClaimsProps) =>
    await Pyserver.sortClaimsTreePipelineStep(
      env,
      {
        ...arg,
        llm: dedupLLMConfig,
      },
      userId,
      reportId,
    ).then((val) =>
      mapResult(val, (arg) => PipelineOutputToProps.makeOutputProps(arg)),
    );

  /**
   * Calls the topic summaries step on the pyserver
   */
  const doTopicSummariesStep = async (tree: OutputProps) =>
    await Pyserver.topicSummariesPipelineStep(
      env,
      {
        tree,
        llm: summariesLLMConfig,
      },
      userId,
      reportId,
    ).then((val) =>
      mapResult(val, (reply) =>
        PipelineOutputToProps.makeSummariesProps(reply),
      ),
    );

  return {
    doTopicTreeStep,
    doClaimsStep,
    doAddons,
    doSortClaimsTreeStep,
    doTopicSummariesStep,
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
