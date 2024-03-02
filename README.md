To run things locally:

1. populate your .env file:

```
export OPENAI_API_KEY="...""
export GOOGLE_APPLICATION_CREDENTIALS="..."
export GCLOUD_STORAGE_BUCKET="..."
```

2. get some google-credential.json file...

Google how

```
./google-credentials.json
```

3. run this...

```
npm i
npm run build
npm start
```
