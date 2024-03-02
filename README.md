To run things locally:

1. Create a `.env` file with an OPENAI key

```
OPENAI_API_KEY=sk-something-something
```

2. Run server locally

```
npm i
npm run build
npm start
```

2. (Optional) Google Cloud Storage

If you want to store files on google clouds, here is what you'll need:

- create a project and a google storage bucket
- make sure this bucket has public access so that anyone can read
- create a service account and give permission to write on that bucket
- create keys for this account and download them as a json files
- save this file as `./google-credentials.json` (root of this repo)
- add the following lines to your `.env` file:

```
GCLOUD_STORAGE_BUCKET=name-of-your-bucket
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

3. (Optional) Running docker locally

We don't recommend developping locally with docker (you would need to re-build after each change),
but it you're debugging docker-related issues, you may want to try the provided scripts:

```
./bin/docker-build.sh # build
./bin/docker-run.sh   # run
```
