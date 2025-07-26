# Development Guide

This guide covers setting up a local development environment for Talk to the City.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   next-client   │◄──►│ express-server  │◄──►│   pyserver      │
│   (Frontend)    │    │   (Backend)     │    │ (LLM Processing)│
│   Port: 3000    │    │   Port: 8080    │    │   Port: 8000    │
└─────────┬───────┘    └─────────┬───────┘    └─────────────────┘
          │                      │
          │                      │
          ▼                      ▼
       ┌─────────────────────────────────────┐
       │             common                  │
       │         (Shared Types,              │
       │      Schemas & Utilities)           │
       └─────────────────────────────────────┘
```

**External Services**: Firebase (Auth), Google Cloud Storage (Reports), Redis (Jobs)

### Data Flow

1. User uploads input CSV → next-client
2. Client sends data → express-server
3. Server queues LLM jobs → pyserver
4. Python processes with LLMs → JSON reports
5. Reports stored in GCS → displayed in client

## Prerequisites

Before starting setup, ensure you have:

- **Node.js 18+** and npm
  - **New to Node.js?** Use [nvm](https://github.com/nvm-sh/nvm) to easily install and switch between Node.js versions:
    ```bash
    # Install and use Node.js 18
    nvm install 18
    nvm use 18
    ```
- **Python 3.8+** and pip
- **Redis server** (local or remote)

You'll also need service accounts and API keys for:

- Firebase project (authentication and database)
- Google Cloud Storage (report storage)
- OpenAI or similar API (LLM processing)

These cloud services are required even for local development, so basic instructions are provided below.

**If you're working at AOI, you'll be given pre-configured access and can skip these steps.**

### Firebase

Firebase provides authentication and database services.

**Setup Steps:**

1. Go to [Firebase Console](https://firebase.google.com/) → "Create a project"
2. Enter a project name and create the project
3. **Enable Authentication:**
   - Go to Authentication → Sign-in method
   - Enable "Google" as a sign-in provider
4. **Create Web App:**
   - Project Overview → Add app → Web (</>)
   - Register app with a nickname
   - Copy the Firebase configuration object (needed for next-client)
5. **Create Service Account:**
   - Project Settings → Service accounts
   - Click "Generate new private key"
   - Save the JSON file as `firebase-credentials.json`
6. **Get Database URL:**
   - Project Settings → General → Your apps
   - Copy the "databaseURL" value

### Google Cloud Storage

Cloud Storage stores generated report JSON files.

**Setup Steps:**

1. Create a [Google Cloud project](https://console.cloud.google.com/)
2. **Create Storage Bucket:**
   - Go to Cloud Storage → Create bucket
   - Choose a globally unique name
   - Select appropriate region and settings
3. **Create Service Account:**
   - IAM & Admin → Service Accounts → Create service account
   - Give it a descriptive name
   - Grant "Storage Admin" role (or minimum "Storage Object Admin")
   - Create and download JSON key file as `google-credentials.json`

### OpenAI API

Required for LLM processing in pyserver.

1. Create account at [OpenAI](https://platform.openai.com/)
2. Generate API key in API settings
3. Save the key securely (will be used in environment variables)

## Local Development Setup

### 1. common (Shared Package)

Contains shared types, schemas, and utilities.
**Important**: Always build the `common` package first as it's required by other services.

```bash
cd common
npm install
npm run build
```

**Note**: Rebuild `common` whenever you modify shared types or schemas, or use the root `npm run dev` which watches for changes.

### 2. Redis

Used for job queue management.

**Install Redis:**

- macOS: `brew install redis`
- Ubuntu: `sudo apt install redis-server`
- [Other platforms](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/)

**Start Redis:**

```bash
redis-server
```

**Verify (optional):**

```bash
redis-cli ping  # Should return "PONG"
```

### 3. pyserver (Python/FastAPI)

Handles LLM processing calls.

**Setup:**

```bash
cd pyserver
python -m venv .venv
source ./.venv/bin/activate
pip install -r requirements.txt
```

**Configuration:**
No environment variables needed - pyserver receives jobs from express-server.

**Run:**

```bash
cd pyserver
source ./.venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
```

**Test:**

```bash
cd pyserver
source ./.venv/bin/activate
pytest
# For coverage: pytest --cov=.
```

### 4. express-server (Node.js/Express)

Main backend API that coordinates with pyserver and manages jobs.

**Setup:**

```bash
cd express-server
npm install
```

**Configuration:**

Create `express-server/.env` file with these variables:

```bash
# Basic config
NODE_ENV=development
CLIENT_BASE_URL=http://localhost:3000
PYSERVER_URL=http://localhost:8000

# Firebase (from your Firebase project)
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
FIREBASE_CREDENTIALS_ENCODED=<base64-encoded-firebase-credentials.json>

# Redis (local development)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
REDIS_QUEUE_NAME=dev-queue

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Google Cloud Storage
GCLOUD_STORAGE_BUCKET=your-bucket-name
ALLOWED_GCS_BUCKETS=your-bucket-name
GOOGLE_CREDENTIALS_ENCODED=<base64-encoded-google-credentials.json>
```

**Encoding Credentials:**

```bash
# Encode Firebase credentials
base64 -i firebase-credentials.json

# Encode Google Cloud credentials
base64 -i google-credentials.json
```

Copy the output strings (without newlines) to the respective `_ENCODED` variables.

**Note**: Never commit the credential JSON files to git. Keep them outside the repo or add them to `.gitignore` if not already present.

**Run:**

```bash
cd express-server
npm run dev
```

**Test:**

```bash
cd express-server
npm test
# For coverage: npm run test:coverage
```

### 5. next-client (Next.js Frontend)

Web application frontend.

**Setup:**

```bash
cd next-client
npm install
```

**Configuration:**

Create `next-client/.env.local` file:

```bash
# Express server URL
PIPELINE_EXPRESS_URL=http://localhost:8080

# Firebase config (public keys from Firebase project settings)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123
```

**Run:**

```bash
cd next-client
npm run dev
```

**Test:**

```bash
cd next-client
npm test
# For coverage: npm run test:coverage
```

## Development Workflow

### Starting All Services

After initial setup, use the convenience script:

```bash
# From repository root
npm run dev
```

This launches:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Python LLM service: http://localhost:8000
- Automatic `common` package rebuilding

### Using the Application

1. Visit http://localhost:3000
2. Sign in with any Google account
3. Upload a CSV file in the format described below or use the samples
4. Click "Generate report" and monitor processing

### CSV Data Format

Required format:

```csv
id,interview,comment
1,participant_1,This is a sample comment
2,participant_2,Another participant's response
```

**Important**: No trailing newline at end of file (Pandas adds this by default).

#### Helpful one-liners for input data formatting

- `pandas.from_json(open(PATH/TO/JSON/FILE), 'r'), lines=True)`
- `comments_only = df['COMMENT_COLUMN_NAME']`
- `short_df = df.head(LINE_COUNT)`
- `df.to_csv(open(PATH/TO/CSV, 'w'))`

### Example Files

See `examples/` directory:

- `reddit_climate_change_posts_500.csv`: Sample climate change posts
