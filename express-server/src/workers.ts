import { Worker, Job } from "bullmq";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import { Env } from "./types/context";
import { llmPipelineToSchema } from "tttc-common/morphisms";
import { connection } from "./Queue";
import { storeJSON } from "./storage";
import * as apiPyserver from "tttc-common/apiPyserver";
import { topicTreePipelineStep } from "./pipeline/topicTreeStep";
import { claimsPipelineStep } from "./pipeline/claimsStep";
import { sortClaimsTreePipelineStep } from "./pipeline/sortClaimsTree";
import { randomUUID } from "crypto";

export const pipeLineWorker = new Worker(
  "pipeline",
  async (job: Job<{ config: schema.OldOptions; env: Env }>) => {
    const { data } = job;
    // const cache = job.data.cache;
    const { config, env } = data;

    const defaultConfig = {
      model: "gpt-4-turbo-preview",
      data: [],
      title: "",
      question: "",
      description: "",
      systemInstructions: "",
      clusteringInstructions: "",
      extractionInstructions: "",
      dedupInstructions: "",
      batchSize: 2, // lower to avoid rate limits! initial was 10,
    };

    const makeLLMConfig = (user_prompt: string): apiPyserver.LLMConfig => ({
      system_prompt: config.systemInstructions,
      user_prompt,
      model_name: config.model || "gpt-4o-mini",
      api_key: config.apiKey,
    });

    const options: schema.OldOptions = { ...defaultConfig, ...config };

    const [topicTreeLLMConfig, claimsLLMConfig, dedupLLMConfig] = [
      options.clusteringInstructions,
      options.extractionInstructions,
      options.dedupInstructions,
    ].map((instructions) => makeLLMConfig(instructions));

    const tracker: schema.Tracker = {
      costs: 0,
      start: Date.now(),
      unmatchedClaims: [],
      prompt_tokens: 0,
      completion_tokens: 0,
    };

    const comments = options.data.map((x, i) => ({
      text: x.comment,
      id: x.id,
    }));

    console.log("Step 1: generating taxonomy of topics and subtopics");
    await job.updateProgress({
      status: api.reportJobStatus.Values.clustering,
    });

    const { data: taxonomy } = await topicTreePipelineStep(env, {
      comments,
      llm: topicTreeLLMConfig,
    });

    console.log("Step 2: extracting claims matching the topics and subtopics");
    await job.updateProgress({
      status: api.reportJobStatus.Values.extraction,
    });
    const { claims_tree } = await claimsPipelineStep(env, {
      tree: { taxonomy },
      comments,
      llm: claimsLLMConfig,
    });

    console.log("Step 3: cleaning and sorting the taxonomy");
    await job.updateProgress({
      status: api.reportJobStatus.Values.sorting,
    });

    const { data: tree } = await sortClaimsTreePipelineStep(env, {
      tree: claims_tree,
      llm: dedupLLMConfig,
    });

    const newTax: schema.Taxonomy = taxonomy.map((t) => ({
      ...t,
      topicId: randomUUID(),
      subtopics: t.subtopics.map((sub) => ({
        ...sub,
        subtopicId: randomUUID(),
        claims: tree
          .find(([tag]) => tag === t.topicName)[1]
          .topics.find(([key]) => key === sub.subtopicName)[1]
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

    console.log("Step 4: wrapping up....");
    await job.updateProgress({
      status: api.reportJobStatus.Values.wrappingup,
    });

    tracker.end = Date.now();
    const secs = (tracker.end - tracker.start) / 1000;
    tracker.duration =
      secs > 60
        ? `${Math.floor(secs / 60)} minutes ${secs % 60} seconds`
        : `${secs} seconds`;

    // next line is important to avoid leaking keys!
    delete options.apiKey;
    console.log(`Pipeline completed in ${tracker.duration}`);
    console.log(
      `Pipeline cost: $${tracker.costs} for ${tracker.prompt_tokens} + ${tracker.completion_tokens} tokens`,
    );
    const llmPipelineOutput: schema.LLMPipelineOutput = {
      ...options,
      ...tracker,
      tree: newTax,
      data: options.data,
    };
    const json = llmPipelineToSchema(llmPipelineOutput);
    await storeJSON(options.filename, JSON.stringify(json), true);
    await job.updateProgress({
      status: api.reportJobStatus.Values.finished,
    });
  },
  { connection },
);

export const setupWorkers = () => pipeLineWorker;
