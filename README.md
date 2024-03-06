# tttc-light-js-server

A backend API for turbo pipeline.

## How to run locally (for development)

Create a `.env` file with your own OpenAI key and set also a password.
If you give this password to a friend, they'll be allowed to use your server by putting this password instead of an OpenAI key.

```
export OPENAI_API_KEY=sk-something-something
export OPENAI_API_KEY_PASSWORD=some-password
```

If a team member has already set up a Google Cloud Storage project, add the keys for that project to the same `.env` file. Otheriwse,
see the "Deploying to Google Cloud" section for how to set up a project.

```
export GCLOUD_STORAGE_BUCKET=some-project
export GOOGLE_CREDENTIALS_ENCODE=some-alphanumeric-string
``

Then run:

```
npm i
npm run build
npm start
```

## API docs

The enpoint to generate reports is `POST /generate` and it expects a JSON body of the following type:

```
export type Options = {
  apiKey?: string;       // a valid OpenAI key with gpt-4 access (or a password to use the server's key)
  data: SourceRow[];     // input data in JSON format, see next section for SourceRow definition
  title: string;         // title for the report, defaults to ""
  question: string;      // the question asked to participants, defaults to ""
  description: string;   //  intro  or abstract to include at the start of the report, defaults to ""
  batchSize?: number;    // max number of parrallel calls for gpt-4, defaults to 5
  filename?: string;     // where to store the report on gcloud (it generate a name if none is provided)
  systemInstructions?: string;      // optional additional instructions for system prompt
  clusteringInstructions?: string;  // optional additional instructions for clustering step
  extractionInstructions?: string;  // optional additional instructions for extraction step
  dedupInstructions?: string;       // optional additional instructions for deduplication step
};
```

The enpoint is implemented in `./src/server.ts` and you can look at the client's file `./public/index.js` (line 108) for an example of how to use it.

## Data format

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

## Provided client

Open `localhost:8080/` to see the example of client provided.
The client is written in plain html/css/js in the `public` folder.

## Deploying to Google Cloud

Set up gcloud SDK on your machine

- install `gloud` (see https://cloud.google.com/sdk/docs/install-sdk)
- `gcloud auth login`
- `gcloud config set project your-project-name`
- `gcloud auth configure-docker`

Use provided script to build and push docker image

- `./bin/docker-build-gloud`

Then use the Google Cloud Run console to deploy new revision.

- open the google console and search for gloud cloud run
- find your project and the `tttc-light-js` app
- click "EDIT AND DEPLOY NEW VERSION"
- find the new docker container that you just pushed (search Google Cloud Registry)

## Setting up new Google Cloud instance

Instructions:

- create a google cloud project and a google storage bucket
- add `GCLOUD_STORAGE_BUCKET=name-of-your-bucket` to your `.env`
- make sure this bucket has public access so that anyone can read
- create a service account and give it permission to write on that bucket ("Editor" role)
- create keys for this account and download them as a json files
- save this file as `./google-credentials.json`
- encode this using by running the command `base64 -i ./google-credentials.json`
- put this in a variable `GOOGLE_APPLICATION_CREDENTIALS` in your `.env`

Your .evn file should then look like this:

```
export OPENAI_API_KEY=sk-something-something
export OPENAI_API_KEY_PASSWORD=some-password
export GCLOUD_STORAGE_BUCKET=name-of-your-bucket
export GOOGLE_APPLICATION_CREDENTIALS=some-long-encoded-string
```

Add a Google Run Service:

- go to the Google Run console
- create service
- Specify the Image Source `gcr.io/your-project-id/tttc-light-js-app` (in the field "Container image URL")
- after creating the service, in the side menu that opened, select the GCR tab and find the image
- allow unauthorised access (like for public APIs)
- select only charge when running (no need to keep this running at all time)
- the first deploy with fail if you haven't set the env variables
- click "EDIT & DEPLOY NEW VERSION" to set all the keys and deploy again

## Using docker locally (not recommended)

There should be no need to use docker for local development, except when working on the Dockerfile or testing something docker-related, in which case you might want to use these scripts:

```
./bin/docker-build-local.sh # build
./bin/docker-run.sh   # run
```
