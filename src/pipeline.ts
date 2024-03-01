import gpt from "./gpt";
import {
  clusteringPrompt,
  dedupPrompt,
  extractionPrompt,
  systemMessage,
} from "./prompts";

import { Options, Tracker, Cache, Claim, Subtopic, Taxonomy } from "./types";

const defaultOptions = {
  data: [],
  title: "",
  question: "",
  description: "",
  systemInstructions: "",
  clusteringInstructions: "",
  extractionInstructions: "",
  batchSize: 10,
};

function insertClaim(taxonomy: Taxonomy, claim: Claim, tracker: Tracker) {
  const { topicName, subtopicName } = claim;
  const matchedTopic = taxonomy.find((topic) => topic.topicName === topicName);
  if (!matchedTopic) {
    console.log("Topic missmatch, skipping claim " + claim.claimId);
    tracker.unmatchedClaims.push(claim);
    return;
  }
  const subtopic = matchedTopic.subtopics.find(
    (subtopic) => subtopic.subtopicName === subtopicName
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

function nestClaims(subtopic: Subtopic, nesting: { [key: string]: string[] }) {
  const map: { [key: string]: Claim } = {};
  subtopic.claims!.forEach((claim) => {
    map[claim.claimId!] = claim;
  });
  subtopic.claims!.forEach((claim) => {
    if (nesting[claim.claimId!]) {
      claim.duplicates = nesting[claim.claimId!]
        .filter((id) => map[id])
        .map((id) => map[id]);
      nesting[claim.claimId!].forEach((id) => {
        if (map[id]) map[id].duplicated = true;
      });
    }
  });
  subtopic.claims = subtopic
    .claims!.filter((claim) => !claim.duplicated)
    .sort((x, y) => (y.duplicates || []).length - (x.duplicates || []).length);
}

async function pipeline(_options: Options, cache?: Cache) {
  const options = { ...defaultOptions, ..._options };
  const tracker: Tracker = { costs: 0, start: Date.now(), unmatchedClaims: [] };
  const comments = JSON.stringify(options.data.map((x) => x.comment));

  console.log("Step 1: generating taxonomy of topics and subtopics");
  const { taxonomy }: { taxonomy: Taxonomy } = await gpt(
    "taxonomy",
    systemMessage(options),
    clusteringPrompt(options, comments),
    tracker,
    cache
  );

  console.log("Step 2: extracting claims matching the topics and subtopics");
  for (let i = 0; i < options.data.length; i += options.batchSize) {
    const batch = options.data.slice(i, i + options.batchSize);
    await Promise.all(
      batch.map(async ({ id, comment }) => {
        const { claims } = await gpt(
          "claims_from_" + id,
          systemMessage(options),
          extractionPrompt(options, JSON.stringify(taxonomy), comment),
          tracker,
          cache
        );
        claims.forEach((claim: Claim, i: number) => {
          insertClaim(
            taxonomy,
            {
              ...claim,
              commentId: id,
              claimId: `${id}-${i}`,
            },
            tracker
          );
        });
      })
    );
  }

  console.log("Step 3: cleaning and sorting the taxonomy");
  taxonomy.forEach((topic) => {
    topic.claimsCount = 0;
    topic.subtopics.forEach((subtopic) => {
      topic.claimsCount! += subtopic.claims!.length;
      subtopic.claimsCount = subtopic.claims!.length;
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
  for (const topic of taxonomy) {
    for (const subtopic of topic.subtopics) {
      const { nesting } = await gpt(
        "nesting_" +
          subtopic.subtopicName
            .replace(/[^a-zA-Z0-9 ]/g, "")
            .replace(/\s/g, "_"),
        systemMessage(options),
        dedupPrompt(JSON.stringify(subtopic.claims)),
        tracker,
        cache
      );
      nestClaims(subtopic, nesting);
    }
  }

  console.log("Step 5: wrapping up....");

  tracker.end = Date.now();
  const secs = (tracker.end - tracker.start) / 1000;
  tracker.duration =
    secs > 60
      ? `${Math.floor(secs / 60)} minutes ${secs % 60} seconds`
      : `${secs} seconds`;

  return { ...options, tree, ...tracker };
}

export default pipeline;

// const styles = `
// body {
//   margin: 20px
// }

// h2, h3 {
//   margin-bottom: 5px;
// }
// h3 {
//   margin-top: 8px;
// }

// .claim {
//   color: gray;
//   cursor: pointer;
//   text-decoration: underline;
// }
// .report-description {
//   font-style: italic;
// }
// .details {
//   display: none;
// }
// .open > .details {
//   display: block;
//   margin-bottom: 1em;
// }
// .quote {
//   font-style: italic;
// }

// .count {
//   font-weight: normal;
//   opacity: 0.5;
// }

// .video {
//   border: none;
// }
// `;

// const setVideo = (claimId: string, video: string, timestamp: string) => {
//   if (!video) return "";
//   const parts = video.split("/");
//   const videoId = parts[parts.length - 1];
//   let [hours, minutes, seconds] = timestamp.split(":").map(Number);
//   let totalSeconds = hours * 3600 + minutes * 60 + seconds;
//   const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
//   return `document.getElementById('video-${claimId}').src = '${src}';`;
// };

// const toHtml = (data: PipelineOutput) => {
//   const sourceMap: any = {};
//   data.data.forEach((d) => {
//     sourceMap[d.id] = d;
//   });
//   let page = "<html>";
//   page += `<style>${styles}</style>`;
//   page += `<h1 id="title">${data.title}</h1>`;
//   page += `<h1 id="question">${data.question}</h1>`;
//   page += `<div class='report-description'>${data.description}</div>`;
//   data.tree.forEach((topic) => {
//     page += `<h2>${topic.topicName} <span class="count">(${topic.claimsCount})</span></h2>`;
//     page += `<div class='topic-description'>${topic.topicShortDescription}</div>`;
//     topic.subtopics.forEach((subtopic) => {
//       page += `<div class="subtopic" id=${subtopic.subtopicId}>`;
//       page += `<h3>${subtopic.subtopicName} <span class="count">(${subtopic.claims!.length})</span></h3>`;
//       page += `<div class='subtopic-description'>${subtopic.subtopicShortDescription}</div>`;
//       page += `<ul>`;
//       subtopic.claims!.forEach((claim) => {
//         page += `<li id="${claim.claimId}">`;
//         let onclick = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
//         const { interview, video, timestamp } = sourceMap[claim.commentId!];
//         if (video) {
//           onclick += setVideo(claim.claimId!, video, timestamp);
//         }
//         const xN = claim.duplicates ? ` (x${1 + claim.duplicates.length})` : "";
//         page += `<span class="claim" onclick="${onclick}">${claim.claim} ${xN}</span>`;
//         page += `<div class='details' id="details-${claim.claimId}">`;
//         if (interview) {
//           page += `Interview: <span class="interview">"${interview}"</span> <br/>`;
//         }
//         if (video) {
//           page += `<iframe id="video-${claim.claimId}" class="video" src="" width="250" height="141" allow="autoplay; fullscreen; picture-in-picture"></iframe><br/>`;
//         }
//         page += `Quote: <span class="quote">"${claim.quote}"</span>`;
//         if (claim.duplicates) {
//           page += `<div>Similar claims:</div>`;
//           page += `<ul>`;
//           claim.duplicates.forEach((claim) => {
//             page += `<li id="${claim.claimId}">`;
//             let onclick = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
//             const { interview, video, timestamp } = sourceMap[claim.commentId!];
//             if (video) {
//               onclick += setVideo(claim.claimId!, video, timestamp);
//             }
//             page += `<span class="claim" onclick="${onclick}">${claim.claim}</span>`;
//             page += `<div class='details' id="details-${claim.claimId}">`;
//             if (interview) {
//               page += `Interview: <span class="interview">"${interview}"</span> <br/>`;
//             }
//             if (video) {
//               page += `<iframe id="video-${claim.claimId}" class="video" src="" width="250" height="141" allow="autoplay; fullscreen; picture-in-picture"></iframe><br/>`;
//             }
//             page += `Quote: <span class="quote">"${claim.quote}"</span>`;
//             page += `</div>`;
//             page += `</li>`;
//           });
//           page += `</ul>`;
//         }
//         page += `</div>`;
//         page += `</li>`;
//       });
//       page += `</ul>`;
//       page += `</div>`;
//     });
//   });
//   return page;
// };

// async function turbo(_options: Options, cache: Cache) {
//   const json = await pipeline(_options, cache);
//   const html = toHtml(json);
//   return { json, html };
// }

// export default turbo;
