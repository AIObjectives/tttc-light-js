# tttc-light-js...

Todo:

- use openAIkey from front-end or AOI key if password provided instead

## Running locally (for development)

Create a `.env` file with your own OpenAI key and set also a password.
If you give this password to a friend, they'll be allowed to use your server by putting this password instead of an OpenAI key.

```
export OPENAI_API_KEY=sk-something-something
export OPENAI_API_KEY_PASSWORD=some-password
```

Then run:

```
npm i
npm run build
npm start
```

## Deploying to Google Cloud

This secion assumes a team member has already set up a google cloud project and given you the keys you need to put in you `.env` file. See next section if that's not the case.

Set up gcloud SDK on you machine

- install `gloud` (see https://cloud.google.com/sdk/docs/install-sdk)
- `gcloud auth login`
- `gcloud config set project your-project-name`
- `gcloud auth configure-docker`

Use provided script to build and push docker image

- `./bin/docker-build-gloud`

Then use the Google Cloud Run console to deploy new revision.

## Setting up new Google Cloud instance

Instructions:

- create a google cloudd project and a google storage bucket
- add `GCLOUD_STORAGE_BUCKET=name-of-your-bucket` to your `.env`
- make sure this bucket has public access so that anyone can read
- create a service account and give it permission to write on that bucket
- create keys for this account and download them as a json files
- save this file as `./google-credentials.json`
- encode this using by running the command `base64 -i ./google-credentials.json`
- put this in a variable `GOOGLE_APPLICATION_CREDENTIALS` in your `.env`

Your .evn file should then look like this:

```
OPENAI_API_KEY=sk-something-something
GCLOUD_STORAGE_BUCKET=name-of-your-bucket
GOOGLE_APPLICATION_CREDENTIALS=some-long-encoded-string
```

Add a Google Run Service:

- go to the Google Run console
- create service
- Specify the Image Source `gcr.io/your-project-id/tttc-light-js-app` (in the field "Container image URL")
- in the side menu that opened, select the GCR tab and find the image
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
