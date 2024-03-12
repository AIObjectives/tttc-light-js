"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _gpt = _interopRequireDefault(require("./gpt"));
var _prompts = require("./prompts");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const defaultOptions = {
  data: [],
  title: "",
  question: "",
  description: "",
  systemInstructions: "",
  clusteringInstructions: "",
  extractionInstructions: "",
  batchSize: 10
};
function insertClaim(taxonomy, claim, tracker) {
  const {
    topicName,
    subtopicName
  } = claim;
  const matchedTopic = taxonomy.find(topic => topic.topicName === topicName);
  if (!matchedTopic) {
    console.log("Topic missmatch, skipping claim " + claim.claimId);
    tracker.unmatchedClaims.push(claim);
    return;
  }
  const subtopic = matchedTopic.subtopics.find(subtopic => subtopic.subtopicName === subtopicName);
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
function nestClaims(subtopic, nesting) {
  const map = {};
  (subtopic.claims || []).forEach(claim => {
    map[claim.claimId] = claim;
  });
  (subtopic.claims || []).forEach(claim => {
    if (nesting[claim.claimId]) {
      claim.duplicates = nesting[claim.claimId].filter(id => map[id]).map(id => map[id]);
      nesting[claim.claimId].forEach(id => {
        if (map[id]) map[id].duplicated = true;
      });
    }
  });
  subtopic.claims = (subtopic.claims || []).filter(claim => !claim.duplicated).sort((x, y) => (y.duplicates || []).length - (x.duplicates || []).length);
}
async function pipeline(_options, cache) {
  const options = {
    ...defaultOptions,
    ..._options
  };
  const tracker = {
    costs: 0,
    start: Date.now(),
    unmatchedClaims: []
  };
  const comments = JSON.stringify(options.data.map(x => x.comment));
  console.log("Step 1: generating taxonomy of topics and subtopics");
  const {
    taxonomy
  } = await (0, _gpt.default)(options.apiKey, "taxonomy", (0, _prompts.systemMessage)(options), (0, _prompts.clusteringPrompt)(options, comments), tracker, cache);
  console.log("Step 2: extracting claims matching the topics and subtopics");
  for (let i = 0; i < options.data.length; i += options.batchSize) {
    const batch = options.data.slice(i, i + options.batchSize);
    await Promise.all(batch.map(async ({
      id,
      comment
    }) => {
      const {
        claims
      } = await (0, _gpt.default)(options.apiKey, "claims_from_" + id, (0, _prompts.systemMessage)(options), (0, _prompts.extractionPrompt)(options, JSON.stringify(taxonomy), comment), tracker, cache);
      claims.forEach((claim, i) => {
        insertClaim(taxonomy, {
          ...claim,
          commentId: id,
          claimId: `${id}-${i}`
        }, tracker);
      });
    }));
  }
  console.log("Step 3: cleaning and sorting the taxonomy");
  taxonomy.forEach(topic => {
    topic.claimsCount = 0;
    topic.subtopics.forEach(subtopic => {
      topic.claimsCount += (subtopic.claims || []).length;
      subtopic.claimsCount = (subtopic.claims || []).length;
    });
    topic.subtopics.sort((a, b) => b.claimsCount - a.claimsCount).filter(x => x.claimsCount > 0);
  });
  const tree = taxonomy.sort((a, b) => b.claimsCount - a.claimsCount).filter(x => x.claimsCount > 0);
  tree.forEach((topic, i) => {
    topic.topicId = `topic-${i}`;
    topic.subtopics.forEach((subtopic, j) => {
      subtopic.subtopicId = `subtopic-${i}-${j}`;
    });
  });
  console.log("Step 4: deduplicating claims in each subtopic");
  for (const topic of taxonomy) {
    for (const subtopic of topic.subtopics) {
      const {
        nesting
      } = await (0, _gpt.default)(options.apiKey, "nesting_" + subtopic.subtopicName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s/g, "_"), (0, _prompts.systemMessage)(options), (0, _prompts.dedupPrompt)(options, JSON.stringify(subtopic.claims)), tracker, cache);
      nestClaims(subtopic, nesting);
    }
  }
  console.log("Step 5: wrapping up....");
  tracker.end = Date.now();
  const secs = (tracker.end - tracker.start) / 1000;
  tracker.duration = secs > 60 ? `${Math.floor(secs / 60)} minutes ${secs % 60} seconds` : `${secs} seconds`;

  // next line is important to avoid leaking keys!
  delete options.apiKey;
  return {
    ...options,
    tree,
    ...tracker
  };
}
var _default = exports.default = pipeline;