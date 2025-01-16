# Machine Learning Workflows in T3C

Note: under very active construction as we separate a new Python server for LLM calls from the front-end app/exiting backend in TypeScript.

## Quickstart

To run the T3C pipeline with a local front-end & backend server, as well as a Python FastAPI server for LLM calls:

### Setup

0. Pull the latest `main`, then go to `common` and run `npm i && npm run build`.
1. Client-side: edit `next-client/.env` to add `export PIPELINE_EXPRESS_URL=http://localhost:8080/`.
2. Server-side: edit `express-server/.env` to add your OpenAI/Anthropic/GCS keys (needs `export OPENAI_API_KEY=[your key here]` and `export OPENAI_API_KEY_PASSWORD=`).
3. Python FastAPI LLM interface: run the following
    ```
    brew install redis
    redis-server
    ```
    then in a new Terminal:
    ```
    cd pyserver
    python -m venv venv
    source ./.venv/bin/activate
    pip install -r requirements.txt
    ```
4. Internal dev env config: copy & paste the additional lines from the T3C Runbook into both env files.

### Creating reports

1. Navigate to `localhost:3000/create` to create a report as usual.
2. Once you click "Generate report", you will see the text "UrlGCloud". This is a hyperlink — open it in a new tab/window.
3. You will see the raw data dump of the generated report in JSON format. The URL of this report will have the form `https://storage.googleapis.com/[GCLOUD_STORAGE_BUCKET]/[generated report id]`
4. To see the pretty report, copy & paste into this full URL: `http://localhost:3000/report/https%3A%2F%2Fstorage.googleapis.com%2F[GCLOUD_STORAGE_BUCKET]%2F[generated report id]`. Note the last delimiter is `%2F` and not the traditional slash :)

## Expected CSV format

TODO: verify this is still relevant

T3C expects a CSV file in a specific format:

- there is **_no newline_** at the end of the file (which Pandas adds by default with `dataframe.to_csv()`)
- the first line denoting the column format is exactly `id,comment,interview`
- each data row contains only those two columns
- data rows do not contain identical duplicate strings (unlikely for most use cases of collecting survey input)

## Provided example files

As an MVP, we provide:

- `reddit_climate_change_posts_500.csv`: the first 500 of these, deduplicated, in the correct format
- (not in repo) `reddit_climate_change_posts_624K.csv`: 624K post titles from Reddit on the topic of climate change

## P.S. Helpful one-liners for input data formatting

TODO: write util scripts?

- pandas.from_json(open(PATH/TO/JSON/FILE), 'r'), lines=True)
- comments_only = df['COMMENT_COLUMN_NAME']
- short_df = df.head(LINE_COUNT)
- df.to_csv(open(PATH/TO/CSV, 'w'))
