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

async function pipeline(_options, cache) {
  const options = { ...defaultOptions, ..._options };
  const tracker = { costs: 0, start: Date.now() };
  const comments = JSON.stringify(options.data.map((x) => x.comment));
  console.log("Generating taxonomy of topics and subtopics...");
  const { taxonomy } = await gpt(
    "taxonomy",
    systemMessage(options),
    clusteringPrompt(options, comments),
    tracker,
    cache
  );
  const unmatched = [];
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
        claims.forEach((_claim, i) => {
          const { claim, quote, topicName, subtopicName } = _claim;
          const matchedTopic = taxonomy.find(
            (topic) => topic.topicName === topicName
          );
          if (!matchedTopic) {
            unmatched.push(_claim);
            return;
          }
          const subtopic = matchedTopic.subtopics.find(
            (subtopic) => subtopic.subtopicName === subtopicName
          );
          if (!subtopic) {
            unmatched.push(_claim);
            return;
          }
          if (!subtopic.claims) {
            subtopic.claims = [];
          }
          subtopic.claims.push({
            claim,
            quote,
            commentId: id,
            claimId: `${id}-${i}`,
          });
        });
      })
    );
  }
  tracker.end = Date.now();
  const secs = (tracker.end - tracker.start) / 1000;
  tracker.duration =
    secs > 60
      ? `${Math.floor(secs / 60)} minutes ${secs % 60} seconds`
      : `${secs} seconds`;

  return { ...options, taxonomy, ...tracker };
}

const sortByClaimCounts = (taxonomy) => {
  taxonomy.forEach((topic) => {
    topic.claimsCount = 0;
    topic.subtopics.forEach((subtopic) => {
      topic.claimsCount += subtopic.claims.length;
    });
    topic.subtopics
      .sort((a, b) => b.claims.length - a.claims.length)
      .filter((x) => x.claims.length > 0);
  });
  return taxonomy
    .sort((a, b) => b.claimsCount - a.claimsCount)
    .filter((x) => x.claimsCount > 0);
};

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
`;

const toHtml = (data) => {
  let page = "<html>";
  page += `<style>${styles}</style>`;
  page += `<h1 id="title">${data.title}</h1>`;
  page += `<h1 id="question">${data.question}</h1>`;
  page += `<div class='report-description'>${data.description}</div>`;
  sortByClaimCounts(data.taxonomy).forEach((topic) => {
    page += `<h2>${topic.topicName} <span class="count">(${topic.claimsCount})</span></h2>`;
    page += `<div class='topic-description'>${topic.topicShortDescription}</div>`;
    topic.subtopics.forEach((subtopic) => {
      page += `<h3>${subtopic.subtopicName} <span class="count">(${subtopic.claims.length})</span></h3>`;
      page += `<div class='subtopic-description'>${subtopic.subtopicShortDescription}</div>`;
      page += `<ul>`;
      subtopic.claims.forEach((claim) => {
        page += `<li id="${claim.claimId}">`;
        page += `<span class="claim" onclick="document.getElementById('${claim.claimId}').classList.toggle('open')">${claim.claim}</span>`;
        page += `<div class='details' id="details-${claim.claimId}">`;
        page += `Quote: <span class="quote">"${claim.quote}"</span>`;
        page += `</div>`;
        page += `</li>`;
      });
      page += `</ul>`;
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
