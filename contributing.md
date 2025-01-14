# Working with Talk to the City

## Quickstart

Latest instructions as we move to a separate Python server for LLM calls.
First, pull the latest from `main` in this repo and start in the root directory (`tttc-light-js`).

### Set up dependencies

1. In a new terminal, run `brew install redis` and `redis-server` to install Redis and start a local Redis server.
2. From the repo root, `cd pyserver` and install the Python package dependencies in `requirements.txt` with your preferred method (e.g. `pip install -r requirements.txt`). Note: this will get more standardized soon.
3. Add this line to `next-client/.env` and `next-client/.env.local`:
   `export PIPELINE_EXPRESS_URL=http://localhost:8080`

### Launch the app

1. From the root level, run `npm i` then `npm run dev`.
2. This should open four windows: the `next-client` app front end at `localhost:3000`, the `express-server` app backend at `localhost:8080`, the `pyserver` Python FastAPI server for LLM calls at `localhost:8000`, and an overall Node watch process from the `common` directory. Ideally none of these windows show errors — if they do, we need to fix them first.
3. In your browser, go to `http://localhost:3000/create` to view the T3C app. To create a report, fill out the fields and click "Generate report"

### Viewing reports

1. Once you click "Generate report", if the process is successful, you will see the text "UrlGCloud". This is a hyperlink — open it in a new tab/window.
2. You will see the raw data dump of the generated report in JSON format. The url of this report will have this form `https://storage.googleapis.com/[GCLOUD_STORAGE_BUCKET]/[generated report id]`, where `GCLOUD_STORAGE_BUCKET` is an environment variable set in `express-server/.env` and the generated report id is an output of this pipeline run.
3. The pretty version of the corresponding report lives at `http://localhost:3000/report/https%3A%2F%2Fstorage.googleapis.com%2F[GCLOUD_STORAGE_BUCKET]%2F[generated report id]`. You can copy & paste and substitute in the values for the generated report id (different for each report you create) and the GCLOUD_STORAGE_BUCKET (likely the same for all testing sessions). Keep in mind that the separator is %2F and not the traditional url slash :)

### Troubleshooting

Adding notes here from issues we surface in testing.

- Power cycling: one good thing to try first is to restart the process in any one of the windows by ending the process and rerunning the specific previous command in that window (e.g. using the up arrow to find it).

## Older instructions below

## Setup

[See the setup instructions in README](./README.md#setup)

## Working in DEV

After you have finished the basic setup:

1. run `npm i` at the root level
2. run `npm run dev` at the root level. This will launch three different terminals
   - the NextJS client dev server
   - The Express app dev server
   - A watcher for changes in `/common`
   - Note: you can run these indepently by running `npm run dev` next/express folders and `npm run watch` in common.
3. Go to `http://localhost:3000` to see the Next client

## Tour De Repo

There are four main folders to look at:

- `/next-client`
  - This is where the frontend client lives.
  - The two main features of it are the ability to submit data to the backend, and to render reports.
- `/express-pipeline`
  - This is the backend Express app that handles submissions and works with the LLM to generate JSON reports.
  - Everything in `express-pipeline/src` will be transpiled into `/dist`.
- `/common`
  - This is where shared type definitions are stored. It's symlinked with `next-client` and `/express-pipeline`.
  - If you don't have the watcher running, you'll need to rebuild anytime there's a change.
- `/bin`
  - Scripts for managing Docker images. The main one you'll need to use is `./bin/docker-build-gcloud.sh`

Some general points:

- The repo mostly uses TypeScript. Use TypeScript by default whenever you can.
- Prettier is used for formatting. Code should always be formatted prior to being committed.
- Husky is used for pre-commit hooks.
- Zod is used for both types and parsing for any data shared across the frontend-backend.

## Submitting PRs

TBD
