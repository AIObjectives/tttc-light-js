# Talk to the City

**Note**: this repo is under very active construction with a new separate Python server for LLM calls—details below are likely to change!
Please create a GitHub Issue for anything you encounter.

Familiar with this repo? See the [local dev quickstart](examples/README.md#quickstart)

[Talk to the City (T3C)](https://ai.objectives.institute/talk-to-the-city) is an open-source LLM-enabled interface for improving collective deliberation and decision-making by analyzing detailed, qualitative data. It aggregates responses and organizes similar claims into a nested tree of main topics and subtopics.

This repo will allow you to setup your own instance of T3C.
The basic workflow is

1. Submit a CSV file or Google Sheet with your survey data, either through the NextJS client in a browser, the Express API, or the Python FastAPI (coming soon)
2. The backend app will use an LLM to parse your data.
3. The backend app will upload a JSON file to a Google Cloud Storage Bucket that you provide.
4. Your report can be viewed by going to `http://[NextJS client url]/report/[encoded url for your JSON file]`.

If you want to use Talk to the City without any setup, you can go to our website at TBD and follow the instructions on [how to use T3C](#usage)

# Local development for T3C

## TL;DR

- Clone this repo
- Set up dependencies: Google Cloud, Firebase, Redis
- Configure Pyserver and your environment via .env files
- Launch a local instance via `npm run dev`

## Setup & configuration

### Clone this repo

Clone the repo to your local computer:

`git clone https://github.com/AIObjectives/tttc-light-js.git`

or if you have git ssh

`git clone git@github.com:AIObjectives/tttc-light-js.git`

### Google Cloud Storage and Services

T3C currently only supports using Google Cloud for storing report data. First create a new storage bucket:

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

### Firebase

To use T3C, you'll need to create a Firebase project.

- Go to the [Firebase Console](https://firebase.google.com/) and click "Create a project" or "Add project"
- Enter a project name
- Click "Create project"
- Once your project is created, you'll need to register your app. In the project overview:
  - Click on web
  - Register app with a nickname
  - Copy the provided Firebase configuration object
  - Optional: we suggest adding this object to `/express-server/configuration`. This folder is not tracked by git and will make the configuration easier to import later.
- TODO setup Auth and Firestore

### Redis

For local development, you can install Redis by following [these instructions](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/). Make sure to start the Redis server on your computer if you want to run it locally.
If you're working on a Mac, the steps are

```
brew install redis
redis-server
```

### Pyserver setup

- Go to `/pyserver` and run: `python -m venv .venv`
- Run `source ./.venv/bin/activate` to run the virtual environment
- Install the project requirements by running `pip install -r requirements.txt`
- You can test to see if it worked by running `fastapi dev main.py` and see if the server spins up.

### env files

You will need to add two .env files, one in `express-server` and one in `next-client`. You can find example .env files at the root of those directories.

#### express-server/.env

Encode your Google Credentials using the service account key you downloaded earlier, by running the command `base64 -i ./google-credentials.json`. (You do need both the path to the json file and the base-64 encoded version.)

```
export OPENAI_API_KEY= # The server's OpenAI API key
export GCLOUD_STORAGE_BUCKET= # name of your bucket
export CLIENT_BASE_URL= # for dev: http://localhost:3000
export GOOGLE_CREDENTIALS_ENCODED= # copy & paste the base64 encoding of your credentials, made above
export PYSERVER_URL= # for dev: http://localhost:8000
export FIREBASE_DATABASE_URL= # found in your firebase project
export FIREBASE_PROJECT_ID= # found in your firebase project
export REDIS_HOST= # for dev: localhost
export REDIS_PORT= # for dev: 6379
export REDIS_URL= # Redis connection URL (required in addition to HOST/PORT)
export NODE_ENV= # dev | staging | prod
```

##### Environment-Specific Requirements

T3C supports three environments with different validation rules:

1. **Development** (`NODE_ENV=dev`)
   - Accepts both HTTP and HTTPS URLs
   - Flexible URL validation
   - Redis configuration required (both HOST/PORT and URL)

2. **Staging** (`NODE_ENV=staging`)
   - Requires HTTPS URLs for external services:
     - CLIENT_BASE_URL
     - PYSERVER_URL
     - FIREBASE_DATABASE_URL
   - Enables automatic HTTP-to-HTTPS redirects
   - Redis configuration required (both HOST/PORT and URL)

3. **Production** (`NODE_ENV=prod`)
   - Same requirements as staging
   - Intended for production deployments

##### Redis Configuration

Redis now requires both connection methods to be configured:
```bash
# Both are required in all environments
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_URL=redis://localhost:6379
```

#### next-client/.env

```
export PIPELINE_EXPRESS_URL= # This is by default localhost:8080 on dev
# Firebase keys below should be found on your firebase project. These are not sensitive and can be shared with the client.
export NEXT_PUBLIC_FIREBASE_API_KEY=
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
export NEXT_PUBLIC_FIREBASE_APP_ID=
```

Copy this file to .env.local in the same directory if you plan to run the dev server (`npm run dev`).

You can add different types of .env files based on your needs for testing, dev, prod, etc. You can read more in the [NextJS docs](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables#default-environment-variables)

#### pyserver/.env

Create a `.env` file in the `pyserver` directory with the following variables:

```
NODE_ENV=dev # Use 'dev', 'staging', or 'prod'
OPENAI_API_KEY=your_openai_api_key
```

This ensures the Python server has access to the same environment configuration as the rest of the system.

## Running a local instance

Note: There is a bug that prevents `/common` from being built correctly. For your first time, before doing anything else, go to `/common` and run `npm i && npm run build`. After this, you should be able to follow the other steps. If the project fails to start in dev, try rebuilding common first.

To launch a local instance:

- Make sure you have completed the setup steps above
- From the root of the repo, run `npm run dev`.
- This will launch three servers:
  - the `next-client` frontend on `localhost:3000`
  - the `express-server` backend on `localhost:8080` and
  - the `pyserver` Python FastAPI server for the LLM calls on `localhost:8000`.
    Additionally, a watcher will spawn that rebuilds `common` when changes are made to it.

### Using docker locally (not recommended)

There should be no need to use docker for local development, except when working on the Dockerfile or testing something docker-related, in which case you might want to use these scripts:

```
./bin/docker-build-local.sh # build
./bin/docker-run.sh   # run
```

### Running a remote Instance

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

#### Host NextJS Client

See here for [how to deploy your NextJS app](https://nextjs.org/docs/pages/building-your-application/deploying).

# Usage

## NextJS client in a browser

This process should work, regardless of whether the app is built locally or remotely. However, the NextJS client can only take CSVs. To submit a Google Sheet, use the API directly.

You can generate your data and view your reports using the NextJS client.

To do so:

1. Navigate to wherever your NextJS client is hosted.
2. On the [hosting location]/create, you should see a form to submit your data. For local development, this defaults to `http://localhost:3000/create`.
3. Enter the title, description, your [api key](#api-key), and add the CSV file.
4. Optionally, click on the advanced settings for further customization.
5. Click submit, and you will shortly see a url for where your JSON data will be stored and the url to view the report.
6. Depending on how large your file was, it should take anywhere from 30 seconds to 15 minutes to finish. So bookmark the link and check on it periodically.
7. Once the JSON data has been uploaded to Google Cloud, you can view the report by going to` http://[client url]/report/[encoded URI for your stored JSON object]`. In local development, this will have the `http://localhost:3000/report/https%3A%2F%2Fstorage.googleapis.com%2F[GCLOUD_STORAGE_BUCKET]%2F[generated report id]`. You can copy & paste and substitute in the values for the generated report id (different for each report you create) and the GCLOUD_STORAGE_BUCKET (likely the same for all testing sessions). Keep in mind that the separator is %2F and not the traditional URL slash.
8. You can then save the report from your browser or add it to your webpage using an iframe. Additionally, if you are signed in, it will save a link to your report at /myReports

Note: The backend Express app does not save your API keys on the server. The NextJS app will save your API keys (and other inputs) in your browser's session storage, which should be secure, and will delete when you close your browser tab.

## API Usage

You can submit your data directly to the Express API using whatever method you're comfortable with.
Note: You must have the NextJS client running to view your report. Otherwise, it will just generate the JSON data.

The enpoint to generate reports is `POST /create` and it expects a JSON body of the following type:

```
export type Options = {
  userConfig: {
    apiKey: string,
    title: string,
    description: string,
    systemInstructions: string,
    clusteringInstructions: string,
    extractionInstructions: string,
    dedupInstructions: string,
  },
  data: ['csv', {
      comment: string,
      id: string,
      interview: string | undefined,
      video: string | undefined,
      timestamp: string | undefined,
    }[]] | ['googlesheet', {
      url: string,
      pieChartColumns: string[],
      filterEmails: string[],
      oneSubmissionPerEmail: boolean,
      }]
};
```

The enpoint is implemented in `express-server/src/server.ts`. You can see an example of it being used in `next-client/src/features/actions/SubmitAction.ts` and in the `examples/` folder.

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

### Acquiring API keys for LLMs

If your organization does not have a key for ChatGPT or Claude, you can obtain one by:

1. Go to [OpenAI's website](https://openai.com/) or [Anthropic's Website](https://anthropic.com) and signup or login.
2. Navigate to the API section, accessible from the dashboard or user menu.
3. Choose a plan if you are not already subscribed.
4. Go the API keys section and press the button to generate a new API key.
5. Save this key and not share it.

# Development and Contributing

Some work in progress—please see the [contributor guide!](/contributing.md)

## Local Development Startup Sequence

For optimal local development, start the components in this dependency order:

1. **Redis Server**
   ```bash
   redis-server
   ```
   Verify with `redis-cli ping` (should return "PONG")

2. **Build Common Types**
   ```bash
   cd common
   npm install
   npm run build
   ```

3. **Python FastAPI Server**
   ```bash
   cd pyserver
   python -m venv .venv
   source ./.venv/bin/activate
   pip install -r requirements.txt
   python main.py
   ```

4. **Express Server**
   ```bash
   cd express-server
   npm install
   npm run dev
   ```

5. **Next.js Client**
   ```bash
   cd next-client
   npm install
   npm run dev
   ```

This order ensures each service has its dependencies already running.

## Running Tests

Run tests for each component individually:

### Common Types
```bash
cd common
npm test
```

### Express Server
```bash
cd express-server
npm test
# For coverage: npm run test:coverage
```

### Python FastAPI Server
```bash
cd pyserver
source ./.venv/bin/activate
pytest
# For coverage: pytest --cov=.
```

### Next.js Client
```bash
cd next-client
npm test
# For coverage: npm run test:coverage
```
