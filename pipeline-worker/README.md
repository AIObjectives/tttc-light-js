# Pipeline Worker

Background job processor for LLM-powered report generation. This worker consumes messages from Google Pub/Sub, executes multi-step pipelines with distributed locking, and persists results to Google Cloud Storage and Firestore.

## Overview

The Pipeline Worker processes user-submitted CSV comments through a sequence of LLM-powered analysis steps:

1. **Clustering** - Group comments into topics and subtopics
2. **Claims Extraction** - Extract key claims from comments
3. **Sort & Deduplicate** - Rank and deduplicate claims
4. **Summaries** - Generate topic summaries
5. **Cruxes** (optional) - Identify points of contention

Each step produces structured JSON output that feeds into the next step. The final report is saved to Google Cloud Storage and referenced in Firestore.

## Architecture

### Core Components

```
pipeline-worker/
├── src/
│   ├── queue/              # Pub/Sub message handling
│   │   ├── handler.ts      # Main job handler
│   │   └── googlepubsub.ts # Pub/Sub client
│   ├── pipeline-runner/    # Pipeline orchestration
│   │   ├── runner.ts       # Execution engine
│   │   ├── state-store.ts  # Redis state management
│   │   └── types.ts        # Type definitions
│   ├── pipeline-steps/     # Individual analysis steps
│   │   ├── clustering/
│   │   ├── claims/
│   │   ├── cruxes/
│   │   ├── sort-and-deduplicate/
│   │   └── summaries/
│   ├── cache/              # Redis abstraction
│   ├── bucketstore/        # GCS abstraction
│   └── datastore/          # Firestore abstraction
```

## Pipeline Flow

### Message Flow

```
[Express Server]
    → Enqueue job to Pub/Sub
        → [Pipeline Worker] receives message
            → Validate config & data
            → Check storage (skip if exists)
            → Acquire distributed lock
            → Execute pipeline steps
            → Upload results to GCS
            → Update Firestore
            → Release lock
```

### Step Execution Flow

Each pipeline step follows this pattern:

```
1. Check Redis for cached result from previous run
2. If cached, validate structure and reuse
3. If not cached, execute step:
   - Call LLM with configured prompts
   - Track token usage and cost
   - Measure duration
4. Save result to Redis with analytics
5. Proceed to next step
```

### State Persistence

Pipeline state is persisted to Redis after every step, enabling recovery from failures:

```typescript
{
  reportId: "abc123",
  userId: "user456",
  status: "running",
  currentStep: "claims",
  stepAnalytics: {
    clustering: { status: "completed", durationMs: 12000, cost: 0.05, ... },
    claims: { status: "in_progress", startedAt: "2024-01-15T10:30:00Z", ... },
    // ...
  },
  completedResults: {
    clustering: { data: [...], usage: {...}, cost: 0.05 },
    // ...
  },
  totalTokens: 5000,
  totalCost: 0.05,
  totalDurationMs: 12000
}
```

## Distributed Locking Mechanism

The Pipeline Worker uses Redis-based distributed locks to prevent concurrent execution of the same pipeline job. This is critical for preventing duplicate LLM API calls and ensuring exactly-once processing.

### Lock Lifecycle

```
1. Worker receives message from Pub/Sub
2. Attempt to acquire lock: SET pipeline_lock:{reportId} {messageId} NX EX 2100
3. If lock acquired:
   - Execute pipeline steps
   - Extend lock after completion: EXPIRE pipeline_lock:{reportId} 600
   - Process results (GCS upload, Firestore update)
   - Release lock: DEL pipeline_lock:{reportId} (if value matches)
4. If lock not acquired:
   - Another worker is processing this job
   - Skip execution (message will be acked)
```

### Lock Parameters

Lock timeouts are defined in `pipeline-runner/constants.ts`:

- **Lock TTL**: `LOCK_TTL_SECONDS = 2100s (35 minutes)`
  - 1.17x the pipeline timeout (30 minutes)
  - Ensures lock outlives pipeline execution even if timeout occurs
  - Prevents duplicate execution if a pipeline times out

- **Lock Extension**: `LOCK_EXTENSION_SECONDS = 600s (10 minutes)`
  - 33% of pipeline timeout
  - Applied after pipeline completes to protect result processing
  - Covers GCS upload and Firestore updates

- **Pipeline Timeout**: `PIPELINE_TIMEOUT_MS = 1800000ms (30 minutes)`
  - Maximum execution time for entire pipeline
  - Individual step timeouts are not enforced

### Why Distributed Locking?

Without locking, the following race condition could occur:

```
Time  | Worker A              | Worker B
------|----------------------|----------------------
T0    | Receive message 1     |
T1    | Start pipeline        |
T2    |                       | Receive message 1 (duplicate/retry)
T3    |                       | Start pipeline (duplicate!)
T4    | Complete step 1       | Complete step 1
T5    | Call LLM for step 2   | Call LLM for step 2 (waste!)
```

With locking:

```
Time  | Worker A              | Worker B
------|----------------------|----------------------
T0    | Receive message 1     |
T1    | Acquire lock ✓        |
T2    | Start pipeline        | Receive message 1 (duplicate/retry)
T3    |                       | Try acquire lock ✗ (already held)
T4    | Complete step 1       | Skip execution
T5    | Call LLM for step 2   |
T6    | Release lock          |
```

### Lock Implementation Details

The lock uses Redis `SET` with `NX` (set if not exists) and `EX` (expiration):

```typescript
// Acquire lock
const lockKey = `pipeline_lock:${reportId}`;
const lockValue = `${reportId}-${Date.now()}-${Math.random()}`;
const acquired = await redis.set(lockKey, lockValue, 'NX', 'EX', LOCK_TTL_SECONDS);

// Verify lock ownership before critical operations
const currentValue = await redis.get(lockKey);
if (currentValue !== lockValue) {
  throw new Error('Lost lock ownership');
}

// Extend lock after pipeline completes
const script = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("expire", KEYS[1], ARGV[2])
  else
    return 0
  end
`;
await redis.eval(script, 1, lockKey, lockValue, LOCK_EXTENSION_SECONDS);

// Release lock (only if we own it)
const script = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;
await redis.eval(script, 1, lockKey, lockValue);
```

### Lock Safety Properties

1. **Mutual Exclusion**: Only one worker can hold the lock at a time
2. **Deadlock Freedom**: Lock expires automatically via Redis TTL
3. **Ownership**: Lock can only be released by the holder (via unique lockValue)
4. **Atomicity**: All lock operations use Lua scripts for atomic read-modify-write

### Handling Lock Expiration

If a lock expires during execution (e.g., due to slow LLM responses):

```
1. Lock expires while Worker A is still processing
2. Worker B acquires lock and starts execution
3. Worker A tries to extend lock → fails (lock lost)
4. Worker A aborts result processing to prevent duplicates
5. Worker B continues and completes the job
```

This is implemented in `queue/handler.ts:542`:

```typescript
// After pipeline completes, extend lock before result processing
const lockExtended = await stateStore.extendPipelineLock(reportId, lockValue);
if (!lockExtended) {
  throw new Error('Lost lock during execution - cannot safely process results');
}
```

### Resume After Failure

When a pipeline fails and is retried:

```
1. New message arrives (manual retry or Pub/Sub redelivery)
2. Worker checks Redis state: status = "failed", currentStep = "claims"
3. Worker acquires lock
4. Worker resumes from last completed step:
   - Reuses clustering result from Redis
   - Re-executes claims step and continues
5. Worker releases lock on completion
```

### Idempotency

The combination of locking and storage checks ensures idempotency:

```typescript
// Before acquiring lock, check if work is already done
const fileExists = await storage.fileExists(`${reportId}.json`);
if (fileExists) {
  return; // Skip execution, report already generated
}

// Check Redis for completed state
const state = await stateStore.get(reportId);
if (state?.status === "completed") {
  return; // Skip execution, pipeline already finished
}
```

## State Recovery

The pipeline automatically recovers from failures by persisting state to Redis:

### Recovery Scenarios

1. **Worker Crash During Step Execution**
   ```
   - State shows: status="running", currentStep="claims"
   - On resume: Re-execute claims step (previous steps already cached)
   ```

2. **Network Timeout During LLM Call**
   ```
   - State shows: status="failed", currentStep="summaries"
   - On resume: Reuse clustering, claims, dedup results; retry summaries
   ```

3. **Redis State Corruption**
   ```
   - Validation fails for cached result
   - Increment validation failure counter
   - Re-execute step (max 3 failures before permanent failure)
   ```

### Validation Failure Tracking

To prevent infinite retry loops on corrupted state:

```typescript
// Each cached result is validated before reuse
if (!validateResultStructure(cachedResult, stepName)) {
  const failureCount = await stateStore.incrementValidationFailure(reportId, stepName);
  if (failureCount >= MAX_VALIDATION_FAILURES) {
    throw new Error('State permanently corrupted - manual intervention required');
  }
  // Discard corrupted result and re-execute step
}
```

The validation failure counter is stored in a separate Redis key (`pipeline_validation_failure:{reportId}:{stepName}`) to enable atomic increment operations (see `state-store.ts:400`).

## Error Handling

### Error Types

- **ValidationError**: Invalid config or data (permanent, not retryable)
- **StorageError**: GCS or Firestore errors (may be transient)
- **HandlerError**: Pipeline execution errors (permanent)
- **PipelineStepError**: Individual step failures (captured in state)

### Error Flow

```
1. Error occurs during pipeline execution
2. State updated: status="failed", error={message, name, step}
3. Firestore updated: status="failed", errorMessage
4. Lock released
5. Message acked (won't be retried automatically)
```

For transient storage errors (network issues), messages are NOT acked and will be retried by Pub/Sub.

## Autoscaling

The pipeline worker is deployed to Google Cloud Run with autoscaling based on incoming Pub/Sub message volume. Cloud Run automatically scales instances up and down based on:

1. **Message concurrency** - Number of unacknowledged messages
2. **CPU utilization** - Instance resource usage
3. **Request processing time** - Long-running pipeline executions

### Autoscaling Configuration

Autoscaling parameters are configured in the Cloud Run deployment workflows:

**Staging** (`.github/workflows/deploy-pipeline-worker.yml`):
- **Min instances**: 0 (scales to zero when idle)
- **Max instances**: 10
- **Concurrency**: 5 (max 5 concurrent messages per instance)
- **CPU**: 2 vCPU per instance
- **Memory**: 4Gi per instance
- **Timeout**: 3600s (1 hour per message)

**Production** (`.github/workflows/deploy-pipeline-worker-production.yml`):
- **Min instances**: 0 (scales to zero when idle)
- **Max instances**: 20
- **Concurrency**: 5 (max 5 concurrent messages per instance)
- **CPU**: 4 vCPU per instance
- **Memory**: 8Gi per instance
- **Timeout**: 3600s (1 hour per message)

### Flow Control

To prevent resource exhaustion, the worker implements Pub/Sub flow control (see `services.ts:89`):

```typescript
flowControl: {
  maxMessages: 5,              // Max 5 concurrent messages per instance
  maxBytes: 500 * 1024 * 1024, // Max 500MB in memory
  allowExcessMessages: false,  // Strict limit enforcement
}
```

This ensures each instance processes at most 5 pipeline jobs simultaneously, preventing memory overload from large comment datasets.

### Health Check Server

The worker runs a simple HTTP server for Cloud Run health checks (see `index.ts:30`):

- **Port**: 8080 (configured via `PORT` environment variable)
- **Endpoints**:
  - `GET /health` - Returns JSON with status, active message count, and uptime
  - `GET /` - Same as `/health`

This allows Cloud Run to verify the worker is alive and ready to process messages.

### Graceful Shutdown

When Cloud Run scales down an instance, the worker:

1. **Closes health check server** - Stops accepting health check requests
2. **Stops accepting new messages** - Closes Pub/Sub subscription
3. **Waits for active messages** - Allows in-flight pipelines to complete (up to 30s)
4. **Exits cleanly** - Ensures Redis state is saved and locks are released

See `index.ts:50` for graceful shutdown implementation.

### Scaling Behavior

#### Scale Up Triggers
- **Message backlog** - Pub/Sub has unacknowledged messages
- **High CPU** - Existing instances near capacity
- **Slow processing** - Messages taking longer than expected

Cloud Run will spawn new instances until the max instance limit is reached.

#### Scale Down Triggers
- **Low message volume** - Few or no pending messages
- **Idle instances** - No active message processing
- **Low CPU** - Instances underutilized

Cloud Run will terminate idle instances after a cooldown period (typically 15 minutes). With min instances set to 0, the service will scale to zero after sustained inactivity, providing cost savings at the expense of a 10-30 second cold start when messages arrive.

### Monitoring Autoscaling

Check Cloud Run metrics for scaling behavior:

```bash
# List current revisions and instance counts
gcloud run services describe stage-t3c-pipeline-worker \
  --region us-central1 \
  --format='table(status.traffic.revisionName, status.traffic.percent, status.conditions.status)'

# View instance metrics
gcloud logging read 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="stage-t3c-pipeline-worker"
  AND jsonPayload.message=~"instance"' \
  --limit 50 \
  --format json
```

### Adjusting Autoscaling

To change autoscaling parameters:

1. **Update workflow files** - Edit `deploy-pipeline-worker.yml` or `deploy-pipeline-worker-production.yml`
2. **Adjust instance limits** - Change `--min-instances` and `--max-instances`
3. **Tune concurrency** - Modify `--concurrency` (balance throughput vs. memory)
4. **Update resources** - Adjust `--cpu` and `--memory` based on workload

Example: Increase production max instances to 50:

```yaml
--max-instances 50
```

Then redeploy:

```bash
git add .github/workflows/deploy-pipeline-worker-production.yml
git commit -m "Increase production worker max instances to 50"
git push
# Trigger workflow manually via GitHub Actions UI
```

### Cost Optimization

Autoscaling helps minimize costs while maintaining performance:

1. **Right-size instances** - 4-8 vCPU sufficient for most workloads
2. **Optimize concurrency** - Higher concurrency = fewer instances needed
3. **Enable zero-scaling** - Use min=0 for non-production environments
4. **Monitor idle time** - Reduce max instances if consistently underutilized

### Troubleshooting Autoscaling

**Problem**: Instances not scaling up despite message backlog

```bash
# Check Pub/Sub subscription metrics
gcloud pubsub subscriptions describe pipeline-worker \
  --format='yaml(ackDeadlineSeconds, messageRetentionDuration)'

# Verify Cloud Run has capacity
gcloud run services describe stage-t3c-pipeline-worker \
  --region us-central1 \
  --format='yaml(spec.template.spec.containerConcurrency, spec.template.spec.containers[0].resources)'
```

**Solution**: Ensure `--concurrency` matches flow control `maxMessages`

**Problem**: Instances scaling too aggressively (cost spike)

```bash
# Check recent scaling events
gcloud logging read 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="stage-t3c-pipeline-worker"
  AND jsonPayload.message=~"scaling"' \
  --limit 100
```

**Solution**: Reduce `--max-instances` or increase `--concurrency` to pack more work per instance

**Problem**: Graceful shutdown timeout (messages lost)

```bash
# Check for shutdown-related errors
pnpm logs pipeline-worker staging --errors --since 1h | grep -i shutdown
```

**Solution**: Increase shutdown timeout in `index.ts:19` (default 30s)

## Configuration

### Environment Variables

Required in `pipeline-worker/.env`:

```bash
# Redis (state persistence)
REDIS_HOST=localhost
REDIS_PORT=6379

# Google Cloud Storage (report files)
GCS_BUCKET_NAME=tttc-reports
GOOGLE_CREDENTIALS_ENCODED=<base64-encoded-service-account-json>

# Firestore (report metadata)
FIREBASE_CREDENTIALS_ENCODED=<base64-encoded-service-account-json>

# Pub/Sub (job queue)
PUBSUB_PROJECT_ID=tttc-light-js
PUBSUB_TOPIC_NAME=pipeline-jobs
PUBSUB_SUBSCRIPTION_NAME=pipeline-worker
```

### Timing Configuration

All timing parameters are in `pipeline-runner/constants.ts`:

```typescript
PIPELINE_TIMEOUT_MS = 30 * 60 * 1000      // 30 minutes
LOCK_TTL_SECONDS = Math.ceil((30 * 60) * 1.17)      // 35 minutes (1.17x timeout)
LOCK_EXTENSION_SECONDS = Math.ceil((30 * 60) * 0.33) // 10 minutes (0.33x timeout)
```

To change the pipeline timeout, update `PIPELINE_TIMEOUT_MS` and the lock TTLs will adjust automatically.

### State TTL

Redis state expires automatically:

- **Successful/Running**: 24 hours
- **Failed**: 1 hour (prevents memory buildup during outages)

## Testing

### Unit Tests

```bash
pnpm --filter=pipeline-worker run test
```

Tests are organized by component:

- `pipeline-runner/__tests__/runner.test.ts` - Pipeline execution
- `pipeline-runner/__tests__/state-store.test.ts` - State management
- `pipeline-runner/__tests__/distributed-locking.integration.test.ts` - Lock behavior
- `queue/__tests__/handler.test.ts` - Message handling

### Integration Tests

Integration tests require running Redis:

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Run integration tests
pnpm --filter=pipeline-worker run test -- distributed-locking.integration.test.ts
```

## Development

### Adding a New Pipeline Step

1. Create step implementation in `pipeline-steps/{step-name}/`
2. Add step to `PipelineStepName` type in `types.ts`
3. Add step execution function in `runner.ts`
4. Update step order in `executeAllSteps()`
5. Add step to initial analytics in `state-store.ts`

### Debugging

View Redis state for a report:

```bash
redis-cli GET "pipeline_state:abc123" | jq
```

View lock status:

```bash
redis-cli GET "pipeline_lock:abc123"
```

View validation failure counters:

```bash
redis-cli KEYS "pipeline_validation_failure:abc123:*"
redis-cli GET "pipeline_validation_failure:abc123:claims"
```

## Common Scenarios

### Scenario 1: Duplicate Message Processing

```
Problem: Same job message delivered twice due to Pub/Sub retry
Solution: First worker acquires lock, second worker skips execution
Result: Only one pipeline execution, no duplicate LLM calls
```

### Scenario 2: Worker Crashes Mid-Pipeline

```
Problem: Worker crashes after completing clustering step
Solution:
1. Lock expires automatically (deadlock prevention)
2. New message/worker starts, checks Redis state
3. Resumes from claims step (reuses cached clustering result)
Result: Pipeline completes without re-running expensive clustering
```

### Scenario 3: Slow LLM Response Causes Timeout

```
Problem: Claims step takes 20 minutes, pipeline times out
Solution:
1. Pipeline execution stops, state saved with current progress
2. Lock remains held until expiration
3. Manual retry or automatic redelivery resumes from next step
Result: Progress preserved, expensive steps not repeated
```

### Scenario 4: Redis State Corruption

```
Problem: Redis memory limit causes truncated state
Solution:
1. Validation fails when attempting to resume
2. Validation failure counter incremented
3. Step re-executed (if count < 3)
4. On 3rd failure, pipeline fails permanently
Result: Automatic recovery with safety limit
```

## Security Considerations

1. **Lock Values**: Include random component to prevent predictable IDs
2. **API Keys**: Passed in job message, never persisted to Redis
3. **User Data**: Comments stored temporarily in Redis, expired after 24h
4. **GCS Access**: Service account with minimal bucket permissions
5. **Firestore Access**: Service account scoped to report collections only

## Performance

### Typical Execution Times

- Clustering: 5-10 minutes (depends on comment count)
- Claims: 3-5 minutes
- Sort & Deduplicate: 1-2 minutes
- Summaries: 1-2 minutes
- Cruxes: 2-4 minutes (if enabled)

Total: 12-23 minutes for full pipeline with cruxes

### Optimization Opportunities

1. **Parallel Step Execution**: Claims and cruxes could run concurrently
2. **Streaming Results**: Process subtopics independently
3. **Caching**: Reuse clustering for similar comment sets
4. **Batch Processing**: Group small jobs to reduce overhead

## Troubleshooting

### Pipeline Stuck in "running" State

```bash
# Check if lock is held
redis-cli GET "pipeline_lock:abc123"

# If lock expired but state not updated, manually fix:
redis-cli HSET "pipeline_state:abc123" status failed
```

### High Validation Failure Rate

```bash
# Check for Redis memory issues
redis-cli INFO memory

# Increase maxmemory or add eviction policy
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Lock Contention on Retries

If manual retries cause lock contention:

```bash
# Wait for lock to expire (35 minutes) or manually release:
redis-cli DEL "pipeline_lock:abc123"
```

## Related Documentation

- Express Server: `express-server/README.md` (job submission)
- Common Package: `common/README.md` (shared types and schemas)
- Python Server: `pyserver/README.md` (LLM API wrapper)
