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
        model: "gpt-4-turbo-preview",
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

      const tracker: schema.Tracker = {
        costs: 0,
        start: Date.now(),
        unmatchedClaims: [],
        prompt_tokens: 0,
        completion_tokens: 0,
      };

      const comments: { speaker: string; text: string; id: string }[] =
        options.data.map((x) => ({
          speaker: x.interview,
          text: x.comment,
          id: x.id,
        }));
      console.log("worker comments", comments);

      if (comments.some((x) => !x.speaker)) {
        throw new Error(
          "Worker expects input data to include interview col to be filled out",
        );
      }

      console.log("Step 1: generating taxonomy of topics and subtopics");
      await job.updateProgress({
        status: api.reportJobStatus.Values.clustering,
      });

      const { data: taxonomy } = await topicTreePipelineStep(env, {
        comments,
        llm: topicTreeLLMConfig,
      });

      console.log(
        "Step 2: extracting claims matching the topics and subtopics",
      );
      await job.updateProgress({
        status: api.reportJobStatus.Values.extraction,
      });
      const { claims_tree } = await claimsPipelineStep(env, {
        tree: { taxonomy },
        comments,
        llm: claimsLLMConfig,
      });

      console.log("Step 2.5: Optionally extract cruxes");
      const { cruxClaims, controversyMatrix, topCruxes, usage} = await cruxesPipelineStep(env, {
        topics: taxonomy,
        crux_tree: claims_tree,
        llm: cruxesLLMConfig,
        top_k: 0
      });
      console.log(topCruxes);
      // package crux addOns together
      const cruxAddOns = {
        topCruxes: topCruxes,
        controversyMatrix : controversyMatrix,
        cruxClaims: cruxClaims,
      }

      console.log("Step 3: cleaning and sorting the taxonomy");
      await job.updateProgress({
        status: api.reportJobStatus.Values.sorting,
      });
      // TODO: more principled way of configuring this?
      const numPeopleSort = "numPeople";

      const { data: tree } = await sortClaimsTreePipelineStep(env, {
        tree: claims_tree,
        llm: dedupLLMConfig,
        sort: numPeopleSort,
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
    { connection },
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
