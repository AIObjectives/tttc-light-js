import { Worker, Job } from "bullmq";
import * as schema from "tttc-common/schema";
import * as api from "tttc-common/api";
import gpt from "./gpt";
import {
  clusteringPrompt,
  dedupPrompt,
  extractionPrompt,
  systemMessage,
} from "./prompts";
import { llmPipelineToSchema } from "../../common/morphisms";
import { connection } from "./Queue";
import { storeJSON } from "./storage";

export const pipeLineWorker = new Worker(
  "pipeline",
  async (job: Job<{ config: schema.OldOptions; cache?: schema.Cache }>) => {
    const { data } = job;
    const cache = job.data.cache;

    const defaultConfig = {
      model: "gpt-4-turbo-preview",
      data: [],
      title: "",
      question: "",
      description: "",
      systemInstructions: "",
      clusteringInstructions: "",
      extractionInstructions: "",
      batchSize: 2, // lower to avoid rate limits! initial was 10,
    };

    const options = { ...defaultConfig, ...data.config };

    const tracker: schema.Tracker = {
      costs: 0,
      start: Date.now(),
      unmatchedClaims: [],
      prompt_tokens: 0,
      completion_tokens: 0,
    };

    const comments = JSON.stringify(options.data.map((x) => x.comment));

    console.log("Step 1: generating taxonomy of topics and subtopics");
    await job.updateProgress({
      status: api.reportJobStatus.Values.clustering,
    });

    const { taxonomy }: { taxonomy: schema.Taxonomy } = await gpt(
      options.model,
      options.apiKey!,
      "taxonomy",
      systemMessage(options),
      clusteringPrompt(options, comments),
      tracker,
      cache,
    );

    console.log("Step 2: extracting claims matching the topics and subtopics");
    await job.updateProgress({
      status: api.reportJobStatus.Values.extraction,
    });

    for (let i = 0; i < options.data.length; i += options.batchSize) {
      const batch = options.data.slice(i, i + options.batchSize);
      await Promise.all(
        batch.map(async ({ id, comment }) => {
          const { claims } = await gpt(
            options.model,
            options.apiKey!,
            "claims_from_" + id,
            systemMessage(options),
            extractionPrompt(options, JSON.stringify(taxonomy), comment),
            tracker,
            cache,
          );
          claims.forEach((claim: schema.LLMClaim, i: number) => {
            insertClaim(
              taxonomy,
              {
                ...claim,
                commentId: id,
                claimId: `${id}-${i}`,
              },
              tracker,
            );
          });
        }),
      );
    }

    console.log("Step 3: cleaning and sorting the taxonomy");
    await job.updateProgress({
      status: api.reportJobStatus.Values.sorting,
    });

    taxonomy.forEach((topic) => {
      topic.claimsCount = 0;
      topic.subtopics.forEach((subtopic) => {
        topic.claimsCount! += (subtopic.claims || []).length;
        subtopic.claimsCount = (subtopic.claims || []).length;
      });
      topic.subtopics
        .sort((a, b) => b.claimsCount! - a.claimsCount!)
        .filter((x) => x.claimsCount! > 0);
    });
    const tree = taxonomy
      .sort((a, b) => b.claimsCount! - a.claimsCount!)
      .filter((x) => x.claimsCount! > 0);
    tree.forEach((topic, i) => {
      topic.topicId = `topic-${i}`;
      topic.subtopics.forEach((subtopic, j) => {
        subtopic.subtopicId = `subtopic-${i}-${j}`;
      });
    });

    console.log("Step 4: deduplicating claims in each subtopic");
    await job.updateProgress({
      status: api.reportJobStatus.Values.dedup,
    });

    for (const topic of taxonomy) {
      for (const subtopic of topic.subtopics) {
        const { nesting } = await gpt(
          options.model,
          options.apiKey!,
          "nesting_" +
            subtopic.subtopicName
              .replace(/[^a-zA-Z0-9 ]/g, "")
              .replace(/\s/g, "_"),
          systemMessage(options),
          dedupPrompt(options, JSON.stringify(subtopic.claims)),
          tracker,
          cache,
        );
        nestClaims(subtopic, nesting);
      }
    }

    console.log("Step 5: wrapping up....");
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
      tree,
      ...tracker,
    };

    await job.updateProgress({
      status: api.reportJobStatus.Values.finished,
    });

    const json = llmPipelineToSchema(llmPipelineOutput);
    await storeJSON(options.filename, JSON.stringify(json), true);
  },
  { connection },
);

function insertClaim(
  taxonomy: schema.Taxonomy,
  claim: schema.LLMClaim,
  tracker: schema.Tracker,
) {
  const { topicName, subtopicName } = claim;
  const matchedTopic = taxonomy.find((topic) => topic.topicName === topicName);
  if (!matchedTopic) {
    console.log("Topic missmatch, skipping claim " + claim.claimId);
    tracker.unmatchedClaims.push(claim);
    return;
  }
  const subtopic = matchedTopic.subtopics.find(
    (subtopic) => subtopic.subtopicName === subtopicName,
  );
  if (!subtopic) {
    console.log("Subtopic missmatch,skipping claim " + claim.claimId);
    tracker.unmatchedClaims.push(claim);
    return;
  }
  if (!subtopic.claims) {
    subtopic.claims = [];
  }
  subtopic.claims.push(claim);
}

function nestClaims(
  subtopic: schema.LLMSubtopic,
  nesting: { [key: string]: string[] },
) {
  const map: { [key: string]: schema.LLMClaim } = {};
  (subtopic.claims || []).forEach((claim) => {
    map[claim.claimId!] = claim;
  });
  (subtopic.claims || []).forEach((claim) => {
    if (nesting[claim.claimId!]) {
      claim.duplicates = nesting[claim.claimId!]
        .filter((id) => map[id])
        .map((id) => map[id]);
      nesting[claim.claimId!].forEach((id) => {
        if (map[id]) map[id].duplicated = true;
      });
    }
  });
  subtopic.claims = (subtopic.claims || [])
    .filter((claim) => !claim.duplicated)
    .sort((x, y) => (y.duplicates || []).length - (x.duplicates || []).length);
}

export const setupWorkers = () => {
  return { pipeLineWorker };
};
