# Architecture Overview

## Monorepo Structure

```
next-client/     # Next.js frontend (TypeScript, Tailwind CSS)
express-server/  # Express.js backend API (TypeScript)
common/          # Shared schemas, utilities, types
pyserver/        # Python FastAPI for LLM processing
pipeline-worker/ # Background job processing
utils/           # Utility scripts
```

## Key Dependencies

- **common/**: Must be built first before other services work
- **Firebase**: Authentication and data storage
- **Google Cloud Storage**: Report JSON files
- **Redis**: Job queuing and caching
- **Zod**: Schema validation across all packages

## Data Flow

1. Users submit CSV → Next.js client
2. Client sends data → Express server
3. Server queues LLM jobs → Python server
4. Python processes with LLMs → JSON reports
5. Reports stored in GCS → displayed in client

## Schema System

`common/schema/index.ts` defines the complete type system:
- Source data types (CSV input)
- LLM processing types
- UI-facing report types
- Pipeline output types

## Firebase SDK Separation

**CRITICAL**: See `00-critical.md` for the full rule.

- `next-client/` → `firebase/*` (client SDK only)
- `express-server/` → `firebase-admin` (admin SDK only)
- Never mix SDKs in the same package

## PostHog Feature Flags

**Server-authoritative checking:**
```typescript
const featureEnabled = await isFeatureEnabled(FEATURE_FLAGS.EXAMPLE_FEATURE, {
  userId: decodedUser.uid,
});
```

**Guidelines:**
- Always check flags server-side for security-sensitive features
- Feature flag failures should fall back to safe defaults
- Combine flags with role-based access control

**Local development:**
```bash
FEATURE_FLAG_PROVIDER=local
LOCAL_FLAGS='{"feature_name_enabled": true}'
```

## Queue System

**Default pipeline queue (PubSub):**
```bash
PUBSUB_TOPIC_NAME=test-topic
PUBSUB_SUBSCRIPTION_NAME=test-subscription
GOOGLE_CLOUD_PROJECT_ID=your-project-id
```

**Optional Node worker queue:**
```bash
NODE_WORKER_TOPIC_NAME=node-worker-topic
NODE_WORKER_SUBSCRIPTION_NAME=node-worker-subscription
```

When the `use_node_worker_queue` feature flag is enabled for a user, pipeline jobs are sent to the Node worker queue instead of the default PubSub queue.

## Firestore Configuration

**Deploy indexes and rules:**
```bash
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```

**Security model:**
- Report references: Read for authenticated users, write for owner only
- Report jobs: Full access only for owner
- User documents: Full access only for the user

## CORS Configuration

**Required in all environments:**
```bash
# Development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Production
ALLOWED_ORIGINS=https://yourdomain.com
```

Never use wildcards or leave empty.
