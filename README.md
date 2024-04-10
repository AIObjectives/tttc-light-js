# tttc-light-js-server

A backend API for turbo pipeline.

## Running the pipeline locally

The current version has a local pipeline that uploads reports to a Google Cloud Storage instance upon completion.

Create a `.env` file with your own OpenAI key.

Optionally, you can also set a password. If you give this password to a friend, they'll be allowed to use your server by putting this password in the OPENAI_API_KEY field in their own .env, instead of copying your OpenAI key directly.

```
export OPENAI_API_KEY=sk-something-something
export OPENAI_API_KEY_PASSWORD=some-password
```

Likewise for Claude:

```
export ANTHROPIC_API_KEY=sk-something-something
export ANTHROPIC_API_KEY_PASSWORD=some-password
```

If a team member has already set up a Google Cloud Storage project, add the keys for that project to the same `.env` file. Otheriwse,
see the "Setting up a Google Cloud instance" section for how to set up a project.

```
export GCLOUD_STORAGE_BUCKET=some-bucket-name
export GOOGLE_CREDENTIALS_ENCODED=some-alphanumeric-string
```

Then run:

```
npm i
npm run build
npm start
```

Keep the npm server running, and provide input through the page at localhost:8080 (to upload a data file),
or through one of the scripts in the `examples/` folder (to reference a Google Sheet).

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

## Provided client

Open `localhost:8080/` to see the example of client provided.
The client is written in plain html/css/js in the `public` folder.

## Setting up a Google Cloud instance

### Set up Google Cloud storage & services

First create a new storage bucket:

- Create a Google Cloud project and a Google Cloud Storage bucket
- Add `GCLOUD_STORAGE_BUCKET=name-of-your-bucket` to your `.env`
- Make sure this bucket has public access so that anyone can read from it (to
  make your reports accessible from your browser): - Turn off the "Prevent public access" protect - In the "Permissions" tab, click "Grant access." Add the principal `allUsers`
  and assign the role `Storage Object User`.

Then create a service account for this bucket:

- In the "IAM & Admin" view, select "Service Accounts" from the left menu, and
  then click "Create service account"
- Give this account the "Editor" role
- Create keys for this account and download them as a json file:
  - Save this file as `./google-credentials.json`
  - Encode this using by running the command `base64 -i ./google-credentials.json`
  - Put this in a variable `GOOGLE_CREDENTIALS_ENCODED` in your `.env`

Your .env file should now look like this:

```
export OPENAI_API_KEY=sk-something-something
export OPENAI_API_KEY_PASSWORD=optional-password
export GCLOUD_STORAGE_BUCKET=name-of-your-bucket
export GOOGLE_CREDENTIALS_ENCODED=some-long-encoded-string
```

### Set up gcloud SDK on your machine

- install `gcloud` (see https://cloud.google.com/sdk/docs/install-sdk)
- `gcloud auth login`
- `gcloud config set project your-project-name`
- `gcloud auth configure-docker`

### Deploy Docker instance to Google Cloud Storage

Use the provided script to build and push the docker image:

- `./bin/docker-build-gcloud.sh`

### Add a Google Run Service

- Go to the Google Run console
- Create a new service
- In the field "Container image URL", specify the Image Source by clicking the "Select" button and choosing the container image for your project in the "Artifact Registry" tab. The Image Source should look something like `gcr.io/your-project-id/tttc-light-js-app@...`. If you don't see your image listed, make sure you've run the Docker build script above without errors.
- Allow unauthorised access ("unauthenticated invocations" -- like for public APIs)
- Select "CPU is only allocated during request processing" (no need to keep this running at all time)

Note: the first deploy with fail if you haven't set the .env variables as described above

Your cloud instance is now ready to use!

To upload a new image (e.g. after a fresh git pull), deploy a new docker image to the same instance:

- Run `./bin/docker-build-gcloud.sh`
- Open the google console and search for gloud cloud run
- Find your project and the `tttc-light-js` app
- Click "EDIT AND DEPLOY NEW VERSION"
- Find the new docker image that you just pushed from the list of available images

## Using docker locally (not recommended)

There should be no need to use docker for local development, except when working on the Dockerfile or testing something docker-related, in which case you might want to use these scripts:

```
./bin/docker-build-local.sh # build
./bin/docker-run.sh   # run
```
