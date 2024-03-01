import OpenAI from "openai";
const openai = new OpenAI();

const defaultOptions = {
  data: [],
  title: "",
  question: "",
  description: "",
  systemInstructions: "",
  clusteringInstructions: "",
  batchSize: 10,
};

const systemMessage = (options) => `
You are a professional research assistant. You have helped run many public consultations, 
surveys and citizen assemblies. You have good instincts when it comes to extracting interesting insights. 
You are familiar with public consultation tools like Pol.is and you understand the benefits 
for working with very clear, concise claims that other people would be able to vote on.
${options.systemInstructions}
`;

const clusteringPrompt = (options, comments) => `
I will give you a list of comments.
I want you to propose a way to break down the information contained in these comments into topics and subtopics of interest. 
Keep the topic and subtopic names very concise and use the short description to explain what the topic is about.
${options.clusteringInstructions}

Return a JSON object of the form {
  "taxonomy": [
    {
      "topicName": string, 
      "topicShortDescription": string,
      "subtopics": [
        {
          "subtopicName": string,  
          "subtopicShortDescription": string, 
        },
        ...
      ]
    }, 
    ... 
  ]
}

Now here is the list of comments:
${comments}
`;

const extractionPrompt = (options, taxonomy, comment) => `
I'm going to give you a comment made by a participant and a list of topics and subtopics which have already been extracted.  
I want you to extract a list of concise claims that the participant may support.
We are only interested in claims that can be mapped to one of the given topic and subtopic. 
The claim must be fairly general but not a platitude. 
It must be something that other people may potentially disagree with. Each claim must also be atomic. 
For each claim, please also provide a relevant quote from the transcript. 
The quote must be as concise as possible while still supporting the argument. 
The quote doesn't need to be a logical argument. 
It could also be a personal story or anecdote illustrating why the interviewee would make this claim. 
You may use "[...]" in the quote to skip the less interesting bits of the quote. 
${options.extractionInstructions} 

Return a JSON object of the form {
  "claims": [
    {
      "claim": string, // a very concise extracted claim
      "quote": string // the exact quote,
      "topicName": string // from the given list of topics
      "subtopicName": string // from the list of subtopics
    }, 
    // ... 
  ]
}

Now here is the list of topics/subtopics: 
${taxonomy}

And then here is the comment:
${comment} 
`;

const dedupPrompt = (claims) => `
I'm going to give you a JSON object containing a list of claims with some ids.
I want you to remove any near-duplicate claims from the list by nesting some claims under some top-level claims. 
For example, if we have 5 claims and claim 3 and 5 are similar to claim 2, we will nest claim 3 and 5 under claim 2. 
The nesting will be represented as a JSON object where the keys are the ids of the 
top-level claims and the values are lists of ids of the nested claims.

Return a JSON object of the form {
  "nesting": {
    "claimId1": [], 
    "claimId2": ["claimId3", "claimId5"],
    "claimId4": []
  }
}

And now, here are the claims:
${claims}
`;

const gpt = async (key, system, user, tracker, cache) => {
  if (cache && cache.get(key)) return cache.get(key);
  const start = Date.now();
  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    model: "gpt-4-turbo-preview",
    response_format: { type: "json_object" },
  });
  const { prompt_tokens, completion_tokens } = completion.usage;
  const cost =
    prompt_tokens * (10 / 1000000) + completion_tokens * (30 / 1000000);
  tracker.costs += cost;
  const { finish_reason, message } = completion.choices[0];
  if (finish_reason !== "stop") {
    console.log(completion);
    console.log(message);
    throw new Error("gpt 4 turbo stopped early!");
  } else {
    const result = JSON.parse(message.content);
    if (cache) cache.set(key, result);
    const _s = ((Date.now() - start) / 1000).toFixed(1);
    const _c = cost.toFixed(2);
    console.log(
      `[${key}] ${_s}s and ~$${_c} for ${prompt_tokens}+${completion_tokens} tokens`
    );
    return result;
  }
};

function insertClaim(taxonomy, claim) {
  const { topicName, subtopicName } = claim;
  const matchedTopic = taxonomy.find((topic) => topic.topicName === topicName);
  if (!matchedTopic) {
    console.log("Topic missmatch, skipping:", claim);
    return;
  }
  const subtopic = matchedTopic.subtopics.find(
    (subtopic) => subtopic.subtopicName === subtopicName
  );
  if (!subtopic) {
    console.log("Subtopic missmatch, skipping:", claim);
    return;
  }
  if (!subtopic.claims) {
    subtopic.claims = [];
  }
  subtopic.claims.push(claim);
}

function nestClaims(subtopic, nesting) {
  const map = {};
  subtopic.claims.forEach((claim) => {
    map[claim.claimId] = claim;
  });
  subtopic.claims.forEach((claim) => {
    if (nesting[claim.claimId]) {
      claim.duplicates = nesting[claim.claimId].map((id) => map[id]);
      nesting[claim.claimId].forEach((id) => {
        map[id].duplicated = true;
      });
    }
  });
  subtopic.claims = subtopic.claims
    .filter((claim) => !claim.duplicated)
    .sort((x, y) => (y.duplicates || []).length - (x.duplicates || []).length);
}

async function pipeline(_options, cache) {
  const options = { ...defaultOptions, ..._options };
  const tracker = { costs: 0, start: Date.now() };
  const comments = JSON.stringify(options.data.map((x) => x.comment));

  console.log("Step 1: generating taxonomy of topics and subtopics");
  const { taxonomy } = await gpt(
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
        claims.forEach((claim, i) => {
          insertClaim(taxonomy, {
            ...claim,
            commentId: id,
            claimId: `${id}-${i}`,
          });
        });
      })
    );
  }

  console.log("Step 3: cleaning and sorting the taxonomy");
  taxonomy.forEach((topic) => {
    topic.claimsCount = 0;
    topic.subtopics.forEach((subtopic) => {
      topic.claimsCount += subtopic.claims.length;
      subtopic.claimsCount = subtopic.claims.length;
    });
    topic.subtopics
      .sort((a, b) => b.claimsCount - a.claimsCount)
      .filter((x) => x.claimsCount > 0);
  });
  const tree = taxonomy
    .sort((a, b) => b.claimsCount - a.claimsCount)
    .filter((x) => x.claimsCount > 0);
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

const styles = `
body {
  margin: 20px
}

h2, h3 {
  margin-bottom: 5px;
}
h3 {
  margin-top: 8px;
}

.claim {
  color: gray;
  cursor: pointer;
  text-decoration: underline;
}
.report-description {
  font-style: italic;
}
.details {
  display: none;
}
.open > .details {
  display: block;
  margin-bottom: 1em;
}
.quote {
  font-style: italic;
}

.count {
  font-weight: normal;
  opacity: 0.5;
}

.video {
  border: none;
}
`;

const setVideo = (claimId, video, timestamp) => {
  if (!video) return "";
  const parts = video.split("/");
  const videoId = parts[parts.length - 1];
  let [hours, minutes, seconds] = timestamp.split(":").map(Number);
  let totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const src = `https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s`;
  return `document.getElementById('video-${claimId}').src = '${src}';`;
};

// const vimeoPlayer = (claimId, video, timestamp) => {
//   const parts = video.split("/");
//   const videoId = parts[parts.length - 1];
//   let [hours, minutes, seconds] = timestamp.split(":").map(Number);
//   let totalSeconds = hours * 3600 + minutes * 60 + seconds;
//   return `<iframe id="video-${claimId}" class="video" src="https://player.vimeo.com/video/${videoId}#t=${totalSeconds}s" width="250" height="141" allow="autoplay; fullscreen; picture-in-picture"></iframe>`;
// };

const toHtml = (data) => {
  const sourceMap = {};
  data.data.forEach((d) => {
    sourceMap[d.id] = d;
  });
  let page = "<html>";
  page += `<style>${styles}</style>`;
  page += `<h1 id="title">${data.title}</h1>`;
  page += `<h1 id="question">${data.question}</h1>`;
  page += `<div class='report-description'>${data.description}</div>`;
  data.tree.forEach((topic) => {
    page += `<h2>${topic.topicName} <span class="count">(${topic.claimsCount})</span></h2>`;
    page += `<div class='topic-description'>${topic.topicShortDescription}</div>`;
    topic.subtopics.forEach((subtopic) => {
      page += `<div class="subtopic" id=${subtopic.subtopicId}>`;
      page += `<h3>${subtopic.subtopicName} <span class="count">(${subtopic.claims.length})</span></h3>`;
      page += `<div class='subtopic-description'>${subtopic.subtopicShortDescription}</div>`;
      page += `<ul>`;
      subtopic.claims.forEach((claim) => {
        page += `<li id="${claim.claimId}">`;
        let onclick = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
        const { interview, video, timestamp } = sourceMap[claim.commentId];
        if (video) {
          onclick += setVideo(claim.claimId, video, timestamp);
        }
        const xN = claim.duplicates ? ` (x${1 + claim.duplicates.length})` : "";
        page += `<span class="claim" onclick="${onclick}">${claim.claim} ${xN}</span>`;
        page += `<div class='details' id="details-${claim.claimId}">`;
        if (interview) {
          page += `Interview: <span class="interview">"${interview}"</span> <br/>`;
        }
        if (video) {
          page += `<iframe id="video-${claim.claimId}" class="video" src="" width="250" height="141" allow="autoplay; fullscreen; picture-in-picture"></iframe><br/>`;
        }
        page += `Quote: <span class="quote">"${claim.quote}"</span>`;
        if (claim.duplicates) {
          page += `<div>Similar claims:</div>`;
          page += `<ul>`;
          claim.duplicates.forEach((claim) => {
            page += `<li id="${claim.claimId}">`;
            let onclick = `document.getElementById('${claim.claimId}').classList.toggle('open');`;
            const { interview, video, timestamp } = sourceMap[claim.commentId];
            if (video) {
              onclick += setVideo(claim.claimId, video, timestamp);
            }
            page += `<span class="claim" onclick="${onclick}">${claim.claim}</span>`;
            page += `<div class='details' id="details-${claim.claimId}">`;
            if (interview) {
              page += `Interview: <span class="interview">"${interview}"</span> <br/>`;
            }
            if (video) {
              page += `<iframe id="video-${claim.claimId}" class="video" src="" width="250" height="141" allow="autoplay; fullscreen; picture-in-picture"></iframe><br/>`;
            }
            page += `Quote: <span class="quote">"${claim.quote}"</span>`;
            page += `</div>`;
            page += `</li>`;
          });
          page += `</ul>`;
        }
        page += `</div>`;
        page += `</li>`;
      });
      page += `</ul>`;
      page += `</div>`;
    });
  });
  return page;
};

async function turbo(_options, cache) {
  const json = await pipeline(_options, cache);
  const html = toHtml(json);
  return { json, html };
}

export default turbo;
