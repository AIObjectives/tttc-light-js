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

**External Services**: Firebase (Auth), Google Cloud Storage (Reports), Redis (Rate Limiting & Caching), Google Pub/Sub (Jobs)

### Data Flow

1. User uploads input CSV → next-client
2. Client sends data → express-server
3. Server queues LLM jobs → pyserver
4. Python processes with LLMs → JSON reports
5. Reports stored in GCS → displayed in client

## Prerequisites

Before starting setup, ensure you have:

- **Node.js 25+** and **pnpm**
  - **New to Node.js?** Use [nvm](https://github.com/nvm-sh/nvm) to easily install and switch between Node.js versions:
    ```bash
    # Install Node.js 25, then use .nvmrc for automatic version selection
    nvm install 25
    nvm use  # Reads version from .nvmrc file
    ```
  - **Install pnpm:**
    ```bash
    corepack enable
    corepack prepare pnpm@9 --activate
    # or: npm install -g pnpm
    ```
- **Python 3.11+** and pip
- **Redis server** (local or remote)

You'll also need service accounts and API keys for:

- Firebase project (authentication and database)
- Google Cloud Storage (report storage)
- Google Cloud Pubsub (queuing jobs for LLM processing)
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
6. **Enable Cloud Firestore:**
   - Go to Firestore Database → Create database
   - Choose "Start in production mode"
   - Select your preferred region
   - Set up security rules to restrict access to authenticated users only

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

## Environment Variable File Format

Use plain `KEY=value` format in `.env` files (no `export` prefix). This ensures compatibility with Docker Compose and dotenv libraries.

To source `.env` files in your shell: `set -a; source .env; set +a`

## Local Development Setup

### 1. Install All Dependencies

From the repository root, install all packages at once using pnpm workspaces:

```bash
# From repository root
pnpm install
```

This installs dependencies for all workspace packages (common, express-server, next-client, pipeline-worker, utils) and sets up git hooks via Husky.

**Safety guardrail**: If you accidentally run `npm install`, you'll see an error message directing you to use pnpm instead.

### 2. Build Common Package

The common package contains shared types, schemas, and utilities.
**Important**: Always build the `common` package first as it's required by other services.

```bash
pnpm --filter=tttc-common run build
```

**Note**: During development, use `pnpm dev:common` to watch for changes and rebuild automatically.

### 3. Redis

Used for rate limiting and LLM response caching (reduces API costs on retries).

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

### 4. GCP Pubsub Emulator

You will need the Google Cloud CLI (`gcloud`) with the Pub/Sub emulator component.

**Install gcloud CLI:**

Follow the [official installation guide](https://cloud.google.com/sdk/docs/install) for your platform.

**Install the Pub/Sub Emulator:**

The installation method depends on how you installed gcloud:

```bash
# If installed via manual SDK download (recommended):
gcloud components install pubsub-emulator
gcloud components update

# If installed via Homebrew (macOS):
# The emulator is included, no extra install needed
```

**Important for Ubuntu/Debian users:** The apt-installed gcloud CLI (`apt-get install google-cloud-cli`) does **not** allow installing additional components like the Pub/Sub emulator. You must use the [manual SDK installation](https://cloud.google.com/sdk/docs/install#linux) instead:

```bash
# Download and extract the SDK (don't use apt)
curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz
tar -xf google-cloud-cli-linux-x86_64.tar.gz
./google-cloud-sdk/install.sh

# Then install the emulator
./google-cloud-sdk/bin/gcloud components install pubsub-emulator
```

If you have both versions installed, verify you're using the manual SDK:

```bash
which gcloud  # Should NOT be /usr/bin/gcloud
# If wrong, add to your shell config (~/.bashrc or ~/.zshrc):
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
```

**Verify Installation:**

```bash
gcloud beta emulators pubsub start --help
```

**Start the Emulator:**

```bash
# Standalone:
gcloud beta emulators pubsub start --host-port=localhost:8085

# Or via pnpm (recommended):
pnpm dev:pubsub
```

### 5. pyserver (Python/FastAPI)

Handles LLM processing calls.

**Setup:**

```bash
cd pyserver
python -m venv .venv
source ./.venv/bin/activate
pip install -r requirements.txt
```

**Configuration:**

Create `pyserver/.env` file with these variables:

```bash
# CORS Configuration (REQUIRED - server will fail to start without this)
ALLOWED_ORIGINS=http://localhost:8080

# Redis for LLM response caching (optional but recommended)
REDIS_URL=redis://localhost:6379
```

**Run:**

```bash
# From repository root (recommended):
pnpm dev:pyserver

# Or manually:
cd pyserver
source ./.venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Note:** Always use `uvicorn` directly. Do not use `fastapi dev` as it changes the working directory and breaks local imports.

**Test:**

```bash
cd pyserver
source ./.venv/bin/activate
pytest
# For coverage: pytest --cov=.
```

### 6. express-server (Node.js/Express)

Main backend API that coordinates with pyserver and manages jobs.

No separate install needed - dependencies were installed by `pnpm install` at root.

**Configuration:**

Create `express-server/.env` file with these variables:

```bash
# Basic config
NODE_ENV=development
CLIENT_BASE_URL=http://localhost:3000
PYSERVER_URL=http://localhost:8000

# Firebase (from your Firebase project)
FIREBASE_CREDENTIALS_ENCODED=<base64-encoded-firebase-credentials.json>

# Redis (local development)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
REDIS_QUEUE_NAME=dev-queue

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# CORS Configuration (REQUIRED)
ALLOWED_ORIGINS=http://localhost:3000

# Google Cloud Storage
GCLOUD_STORAGE_BUCKET=your-bucket-name
ALLOWED_GCS_BUCKETS=your-bucket-name
GOOGLE_CREDENTIALS_ENCODED=<base64-encoded-google-credentials.json>

# Google Pub/Sub (optional - defaults shown)
PUBSUB_TOPIC_NAME=test-topic
PUBSUB_SUBSCRIPTION_NAME=test-subscription

# Perspective API (optional - for bridging content evaluation)
# PERSPECTIVE_API_KEY=your-perspective-api-key

# Feature Flags
FEATURE_FLAG_PROVIDER=local
LOCAL_FLAGS='{"exampleBool": true, "exampleString": "string"}'

ANALYTICS_PROVIDER=local
ANALYTICS_ENABLED=false

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
pnpm dev:server
# or: pnpm --filter=express-server run dev
```

**Test:**

```bash
pnpm --filter=express-server run test
# For coverage: pnpm --filter=express-server run test:coverage
```

### 7. next-client (Next.js Frontend)

Web application frontend.

No separate install needed - dependencies were installed by `pnpm install` at root.

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
pnpm dev:client
# or: pnpm --filter=next-client run dev
```

**Test:**

```bash
pnpm --filter=next-client run test
# For coverage: pnpm --filter=next-client run test:coverage
```

## Development Workflow

### Starting All Services

After initial setup, start all services with colored, labeled output:

```bash
# From repository root
pnpm dev
```

This launches concurrently:

- **common**: Watch mode for automatic rebuilding
- **server**: Express backend API at http://localhost:8080
- **client**: Next.js frontend at http://localhost:3000
- **pubsub**: Google Pub/Sub emulator at localhost:8085
- **pyserver**: Python FastAPI server at http://localhost:8000

### Starting Individual Services

For more control, start services individually:

```bash
pnpm dev:common   # Common package in watch mode
pnpm dev:server   # Express server only
pnpm dev:client   # Next.js client only
pnpm dev:pubsub   # Pub/Sub emulator only
pnpm dev:pyserver # Python server only
```

This is useful when:

- You only need certain services running
- A service crashes and needs restarting
- You want to see logs from a specific service

### Turborepo Remote Cache (Optional)

The project uses Turborepo for build orchestration with an optional shared remote cache. Without setup, you still get local caching and parallel builds. With remote cache enabled, you'll share cached build artifacts with CI and other developers.

**To enable remote cache:**

1. Get `TURBO_TOKEN` and `TURBO_TEAM` from Bitwarden (shared team credentials)
2. Add to your shell profile (`~/.bashrc` or `~/.zshrc`):
   ```bash
   export TURBO_TOKEN="<from-bitwarden>"
   export TURBO_TEAM="<from-bitwarden>"
   ```
3. Restart your terminal or run `source ~/.zshrc`

**Verify it's working:**

```bash
pnpm build
# Should show: "Remote caching enabled"
# Subsequent builds show: "FULL TURBO" with cache hits
```

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

**Recommended**: Use the sample CSV from the create page (same file users can download):

- `next-client/public/Talk-to-the-City-Sample.csv`: Clean 9-row dataset with all columns

**Larger datasets** in `examples/sample_csv_files/` directory:

- `reddit_climate_change_posts_500.csv`: 500 Reddit posts (uses `id,comment` format)
- `tiny.csv`, `pets.csv`: Small test files for development
