# Machine Learning Workflows in T3C

Note: under very active construction as we separate a new Python server for LLM calls from the front-end app/exiting backend in TypeScript.

## Quickstart

To run the T3C pipeline with a local front-end & backend server, as well as a Python FastAPI server for LLM calls:

1. Client-side: update `next-client/.env` to point to the report generation endpoint (e.g. `export PIPELINE_EXPRESS_URL=http://localhost:8080/`) and run `npm run dev`
2. Server-side: update `express-server/.env` with OpenAI/Anthropic/GCS keys and run `npm i && npm run dev`.
3. Python FastAPI LLM interface: install Python requirements via `cd pyserver`, then `pip install -r requirements.txt`. Install Redis and start a server: `brew install redis`, `redis-server`. From `pyserver`, run `source .venv/bin/activate && fastapi dev main.py`.
4. Navigate to `localhost:3000/create` and upload a CSV file from the UI. Make sure the CSV is formatted as follows

## Expected CSV format

T3C expects a CSV file in a specific format:

- there is **_no newline_** at the end of the file (which Pandas adds by default with `dataframe.to_csv()`)
- the first line denoting the column format is exactly `id,comment`
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
