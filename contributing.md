# Working with Talk to the City

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