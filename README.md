# Talk to the City

**Note**: this repo is under very active construction with a new separate Python server for LLM calls—details below are likely to change!
Please create a GitHub Issue for anything you encounter.

Latest instructions for local development are [here.](/.contributing.md)


[Talk to the City (T3C)](https://ai.objectives.institute/talk-to-the-city) is an open-source LLM-enabled interface for improving collective deliberation and decision-making by analyzing detailed, qualitative data. It aggregates responses and organizes similar claims into a nested tree of main topics and subropics.

This repo will allow you to setup your own instance of T3C.
The basic workflow is

1. Submit a CSV file or Google Sheet with your survey data, either through the NextJS client or the Express API.
2. The backend app will use an LLM to parse your data.
3. The backend app will upload a JSON file to a Google Cloud Storage Bucket that you provide.
4. Your report can be viewed by going to `http://[next client url]/report/[encoded url for your JSON file]`.

If you want to use Talk to the City without any setup, you can go to our website at TBD and follow the instructions on [how to use T3C](#usage)

## Setup

Clone the repo to your local computer:

`git clone https://github.com/AIObjectives/tttc-light-js.git`

or if you have git ssh

`git clone git@github.com:AIObjectives/tttc-light-js.git`

### Google Cloud Storage and Services

T3C currently only supports using Google Cloud for storing report data out of the box.

First create a new storage bucket:

- Create a Google Cloud project and a Google Cloud Storage bucket
  - When you get to the section "Choose how to control access to objects", uncheck "Enforce public access prevention"
- Make sure this bucket has public access so that anyone can read from it (to
  make your reports accessible from your browser):
  - Turn off "Prevent public access" protect.
  - In the "Permissions" tab, click "Grant access." Add the principal `allUsers`
    and assign the role `Storage Object User`.

Then create a service account for this bucket:

- In the "IAM & Admin" view, select "Service Accounts" from the left menu, and
  then click "Create service account"
- Give this account the "Editor" role
- Create keys for this account and download them as a json file:
- Save this file as `./google-credentials.json`, it will be used in the next step.

Set up gcloud SDK on your machine

- install `gcloud` (see https://cloud.google.com/sdk/docs/install-sdk)
- `gcloud auth login`
- `gcloud config set project your-project-name`
- `gcloud auth configure-docker`

### .env

You will need to add two .env files

#### express-server/.env

Encode your google credentials using the service account key you downloaded earlier by running the command `base64 -i ./google-credentials.json`

```
export GCLOUD_STORAGE_BUCKET=some-bucket-name
export GOOGLE_CREDENTIALS_ENCODED=some-alphanumeric-string-from-previous-step
export CLIENT_BASE_URL=http://wherever-your-client-is

# either
export OPENAI_API_KEY=sk-something-something
export OPENAI_API_KEY_PASSWORD=some-password
# or
export ANTHROPIC_API_KEY=sk-something-something
export ANTHROPIC_API_KEY_PASSWORD=some-password
```

#### next-client/.env

```
export PIPELINE_EXPRESS_URL=http://wherever-youre-hosting-backend/generate
```

Copy this file to .env.local in the same directory if you plan to run the dev server (`npm run dev`).

You can add different types of .env files based on your needs for testing, dev, prod, etc. You can read more in the [NextJS docs](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables#default-environment-variables)

### Local Instance

(see [this](./contributing.md) to run in dev mode instead of prod)

If you want to run a local version of the app that's not publically accessible:

1. Open up your terminal and navigate to the repo folder (e.g. /Desktop/tttc-light-js)
2. Run `npm run build`.
3. Run `npm run dev` to star the dev server. This will run three servers: the ``next-client`` frontend on localhost:3000, the ``express-server`` backend on localhost:8080, and the ``pyserver`` Python FastAPI server for the LLM calls on localhost:8000.
4. This build will be optimized for production.

#### Using docker locally (not recommended)

There should be no need to use docker for local development, except when working on the Dockerfile or testing something docker-related, in which case you might want to use these scripts:

```
./bin/docker-build-local.sh # build
./bin/docker-run.sh   # run
```

### Remote Instance

#### Add Docker Image

#### Add a Google Run Service

- Run `./bin/docker-build-gcloud.sh`, which will build and upload an image to the cloud.
- Open the google console and search for gloud cloud run.
- Click "EDIT AND DEPLOY NEW VERSION".
- Find the new docker image that you just pushed from the list of available images.
- Allow unauthorised access ("unauthenticated invocations" -- like for public APIs).
- Select "CPU is only allocated during request processing" (no need to keep this running at all time)

Note: the first deploy with fail if you haven't set the .env variables as described above.

Your cloud instance is now ready to use!

To upload a new image (e.g. after a fresh git pull), deploy a new docker image to the same instance:

#### Host Next Client

See here for [how to deploy your NextJS app](https://nextjs.org/docs/pages/building-your-application/deploying).

## Usage

### Next Client

This process should work, regardless of whether the app is built locally or remotely. However, the Next client can only take csvs. To submit a Google Sheet, use the API directly.

You can generate your data and view your reports using the Next client.

To do so:

1. Navigate to wherever your Next client is being hosted.
2. On the homepage you should see a form to submit your data.
3. Enter the title, your [api key](#api-key), and add the csv file.
4. Optionally: You can click on the advanced settings for further customization.
5. Click submit. It should soon after give you the url for where your JSON data will be stored and the url to view the report.
6. Depending on how large your file was, it should take anywhere from 30 seconds to 15 minutes to finish. So bookmark the link and check on it periodically.
7. Once the JSON data has been uploaded to Google Cloud, you can view the report by going to` http://[client url]/report/[encoded uri for your stored JSON object]`. You can then save the report from your browser or add it to your webpage using an iframe.

Note: The backend Express app does not save your API keys on the server. The Next app will save your API keys (and other inputs) in your browser's session storage, which should be secure, and will delete when you close your browser tab.

### API

You can submit your data directly to the Express API using whatever method you're comfortable with.
Note: You must have the Next client running to view your report. Otherwise, it will just generate the JSON data.

The enpoint to generate reports is `POST /generate` and it expects a JSON body of the following type:

```
export type Options = {
  model?: optional;
  apiKey: string;       // a valid OpenAI key with gpt-4 access (or a password to use the server's key)
  data: SourceRow[];     // input data in JSON format, see next section for SourceRow definition
  title: string;         // title for the report, defaults to ""
  question: string;      // the question asked to participants, defaults to ""
  pieCharts?: {title:string, items: {label:string, count:number}[]}[]; // optional array if you want pie charts in your report
  description: string;   //  intro  or abstract to include at the start of the report, defaults to ""
  batchSize?: number;    // max number of parrallel calls for gpt-4, defaults to 5
  filename?: string;     // where to store the report on gcloud (it generate a name if none is provided)
  systemInstructions?: string;      // optional additional instructions for system prompt
  clusteringInstructions?: string;  // optional additional instructions for clustering step
  extractionInstructions?: string;  // optional additional instructions for extraction step
  dedupInstructions?: string;       // optional additional instructions for deduplication step
  googleSheet?: {url: string, pieChartColumns?:string[], filterEmails?: string[], onSubmissionPerEmail: boolean} // optional data input using google sheets
};
```

The enpoint is implemented in `express-pipeline/src/server.ts`. You can see an example of it being used in `next-client/src/features/actions/SubmitAction.ts` and in the `examples/` folder.

The data field must contain an array of objects of the following type:

```
export type SourceRow = {
  id: string;        // unique id per raw
  comment: string;   // main content

  // optional fields for video interviews:
  interview?: string; // name of participants
  video?: string;     // link to a video hosted on Vimeo
  timestamp?: string; // timestamp in the video
};
```

## API Key

If your organization does not have a key for ChatGPT or Claude, you can obtain one by:

1. Go to [OpenAI's website](https://openai.com/) or [Anthropic's Website](https://anthropic.com) and signup or login.
2. Navigate to the API section, accessible from the dashboard or user menu.
3. Choose a plan if you are not already subscribed.
4. Go the API keys section and press the button to generate a new API key.
5. Save this key and not share it.

## Development and Contributing

See DEV.md
