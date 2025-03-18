import { Worker, Job } from "bullmq";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import { Env } from "./types/context";
import { llmPipelineToSchema } from "tttc-common/morphisms";
import { storeJSON } from "./storage";
import * as apiPyserver from "tttc-common/apiPyserver";
import { topicTreePipelineStep } from "./pipeline/topicTreeStep";
import { claimsPipelineStep } from "./pipeline/claimsStep";
import { cruxesPipelineStep } from "./pipeline/cruxesStep";
import { sortClaimsTreePipelineStep } from "./pipeline/sortClaimsTree";
import { randomUUID } from "crypto";
import * as firebase from "./Firebase";
import Redis from "ioredis";

type FirebaseDetails = {
  reportDataUri: string;
  userId: string;
  firebaseJobId: string;
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

const logTokensInTracker = (tracker: schema.Tracker) => {
  console.log(
    `Cost:$${tracker.costs};Tok_in:${tracker.prompt_tokens};Tok_out:${tracker.completion_tokens}`,
  );
};

const setupPipelineWorker = (connection: Redis) => {
  const pipeLineWorker = new Worker(
    "pipeline",
    async (
      job: Job<{
        config: schema.OldOptions;
        env: Env;
        firebaseDetails: FirebaseDetails | null;
      }>,
    ) => {
      const { data } = job;
      // const cache = job.data.cache;
      const { config, env, firebaseDetails } = data;

      const defaultConfig = {
        model: "gpt-4o-mini",
        data: [],
        title: "",
        question: "",
        description: "",
        systemInstructions: "",
        clusteringInstructions: "",
        extractionInstructions: "",
        dedupInstructions: "",
        cruxInstructions: "",
        batchSize: 2, // lower to avoid rate limits! initial was 10,
      };

      const makeLLMConfig = (user_prompt: string): apiPyserver.LLMConfig => ({
        system_prompt: config.systemInstructions,
        user_prompt,
        model_name: config.model || "gpt-4o-mini",
        api_key: config.apiKey,
      });

      const options: schema.OldOptions = { ...defaultConfig, ...config };

      const [
        topicTreeLLMConfig,
        claimsLLMConfig,
        dedupLLMConfig,
        cruxesLLMConfig,
      ] = [
        options.clusteringInstructions,
        options.extractionInstructions,
        options.dedupInstructions,
        options.cruxInstructions,
      ].map((instructions) => makeLLMConfig(instructions));

      const initTracker: schema.Tracker = {
        costs: 0,
        start: Date.now(),
        unmatchedClaims: [],
        prompt_tokens: 0,
        total_tokens: 0,
        completion_tokens: 0,
      };

      const comments: { speaker: string; text: string; id: string }[] =
        options.data.map((x) => ({
          speaker: x.interview,
          text: x.comment,
          id: x.id,
        }));
      console.log("input comment row count: ", comments.length);

      if (comments.some((x) => !x.speaker)) {
        throw new Error(
          "Worker expects input data to include interview col to be filled out",
        );
      }

      console.log("Step 1: generating taxonomy of topics and subtopics");
      await job.updateProgress({
        status: api.reportJobStatus.Values.clustering,
      });

      const {
        data: taxonomy,
        usage: topicTreeTokens,
        cost: topicTreeCost,
      } = await topicTreePipelineStep(env, {
        comments,
        llm: topicTreeLLMConfig,
      });

      const tracker_step1 = sumTokensCost({
        tracker: initTracker,
        stepUsage: topicTreeTokens,
        stepCost: topicTreeCost,
      });

      logTokensInTracker(tracker_step1);

      console.log(
        "Step 2: extracting claims matching the topics and subtopics",
      );
      await job.updateProgress({
        status: api.reportJobStatus.Values.extraction,
      });
      const {
        claims_tree,
        usage: claimsTokens,
        cost: claimsCost,
      } = await claimsPipelineStep(env, {
        tree: { taxonomy },
        comments,
        llm: claimsLLMConfig,
      });

      const tracker_step2 = sumTokensCost({
        tracker: tracker_step1,
        stepUsage: claimsTokens,
        stepCost: claimsCost,
      });
      logTokensInTracker(tracker_step2);

      console.log("Step 2.5: Optionally extract cruxes");
      const {
        cruxClaims,
        controversyMatrix,
        topCruxes,
        usage: cruxTokens,
        cost: cruxCost,
      } = await cruxesPipelineStep(env, {
        topics: taxonomy,
        crux_tree: claims_tree,
        llm: cruxesLLMConfig,
        top_k: 0,
      });
      // package crux addOns together
      const cruxAddOns = {
        topCruxes: topCruxes,
        controversyMatrix: controversyMatrix,
        cruxClaims: cruxClaims,
      };

      const tracker_crux = sumTokensCost({
        tracker: tracker_step2,
        stepUsage: cruxTokens,
        stepCost: cruxCost,
      });
      logTokensInTracker(tracker_crux);

      console.log("Step 3: cleaning and sorting the taxonomy");
      await job.updateProgress({
        status: api.reportJobStatus.Values.sorting,
      });
      // TODO: more principled way of configuring this?
      const numPeopleSort = "numPeople";

      const {
        data: tree,
        usage: sortClaimsTreeTokens,
        cost: sortClaimsTreeCost,
      } = await sortClaimsTreePipelineStep(env, {
        tree: claims_tree,
        llm: dedupLLMConfig,
        sort: numPeopleSort,
      });

      const tracker_step3 = sumTokensCost({
        tracker: tracker_crux,
        stepUsage: sortClaimsTreeTokens,
        stepCost: sortClaimsTreeCost,
      });
      logTokensInTracker(tracker_step3);

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

      const tracker_wrappingup = tracker_step3;

      // const secs = (tracker.end - tracker.start) / 1000;
      // tracker.duration =
      // secs > 60
      //   ? `${Math.floor(secs / 60)} minutes ${secs % 60} seconds`
      //   : `${secs} seconds`;
      const end = Date.now();
      const secs = (end - tracker_wrappingup.start) / 1000;

      const tracker_end: schema.Tracker = {
        ...tracker_wrappingup,
        end,
        duration:
          secs > 60
            ? `${Math.floor(secs / 60)} minutes ${secs % 60} seconds`
            : `${secs} seconds`,
      };

      // next line is important to avoid leaking keys!
      delete options.apiKey;
      console.log(`Pipeline completed in ${tracker_end.duration}`);
      console.log(
        `Pipeline cost: $${tracker_end.costs} for ${tracker_end.prompt_tokens} + ${tracker_end.completion_tokens} tokens (${tracker_end.total_tokens} total)`,
      );
      const llmPipelineOutput: schema.LLMPipelineOutput = {
        ...options,
        ...tracker_end,
        tree: newTax,
        data: options.data,
        addOns: cruxAddOns,
      };
      const json = llmPipelineToSchema(llmPipelineOutput);
      await storeJSON(options.filename, JSON.stringify(json), true);
      if (firebaseDetails) {
        await firebase.updateReportJobStatus(
          firebaseDetails.firebaseJobId,
          "finished",
        );
        await firebase.addReportRef(firebaseDetails.firebaseJobId, {
          title: json.data[1].title,
          userId: firebaseDetails.userId,
          reportDataUri: firebaseDetails.reportDataUri,
          description: llmPipelineOutput.description,
          numTopics: json.data[1].topics.length,
          numSubtopics: json.data[1].topics.flatMap((t) => t.subtopics.flat())
            .length,
          numClaims: json.data[1].topics.flatMap((t) =>
            t.subtopics.flatMap((sb) => sb.claims.flat()),
          ).length,
          // find the number of unique people interviewed. If a interview entry isn't there, assume that each is unique
          numPeople: new Set(
            llmPipelineOutput.data.map(
              (v) => v.interview || Math.random().toString(36).slice(2, 10),
            ),
          ).size,
          createdDate: new Date(json.data[1].date),
        });
      }
      await job.updateProgress({
        status: api.reportJobStatus.Values.finished,
      });
    },
    { connection, stalledInterval: 3000000, skipStalledCheck: true }, // ! the stalledInterval and skipStalledCheck is a magical solution to the timeout problem. Need to find a better long-term fix
  );

  pipeLineWorker.on("failed", async (job, e) => {
    // Update Firestore reportJob to failed status
    try {
      await firebase.updateReportJobStatus(
        job.data.firebaseDetails.firebaseJobId,
        "failed",
      );
    } catch (e) {
      // if job not found, don't throw a fit
      if (e instanceof firebase.JobNotFoundError) {
        return;
      } else if (e instanceof Error) {
        // TODO: do we want to throw an error here?
        // throw new Error("Could not update Firestore reportJob to failed status: " + e.message)
      }
    }
    console.error(
      "Pipeline worker failed: " +
        (e instanceof Error ? `${e.message}: ${e.stack}` : e),
    );
    // TODO: Logging 🪵
  });

  return pipeLineWorker;
};

export const setupWorkers = (connection: Redis) =>
  setupPipelineWorker(connection);
