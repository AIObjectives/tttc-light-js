# Debugging

## Cloud Run Logs

Fetch logs using the `pnpm logs` utility:

```bash
# Quick examples
pnpm logs server staging --since 1h
pnpm logs pyserver prod --errors --since 2h
pnpm logs server prod --from "2026-01-05T10:00:00Z" --to "2026-01-05T12:00:00Z"
pnpm logs server ephemeral --pr 123
pnpm logs server staging > /tmp/logs.json
```

**Services:** `server`, `pyserver`, `client`
**Environments:** `staging`, `prod`, `ephemeral` (requires `--pr`)

**Options:**
- `--since <duration>` - Time window (e.g., `30m`, `2h`, `1d`)
- `--from/--to <timestamp>` - Time range (ISO 8601)
- `--errors` - ERROR and higher severity only
- `--request-id <id>` - Filter by correlation ID
- `--limit <n>` - Max entries (default: 500)

**Service name mapping:**
| Alias | Staging | Production |
|-------|---------|------------|
| `server` | `stage-t3c-express-server` | `ts-server-brandon` |
| `pyserver` | `stage-t3c-pyserver` | `pyserver-brandon` |
| `client` | `t3c-next-client-staging` | `t3c-next-client` |

**Prerequisites:**
```bash
gcloud auth login
gcloud config set project tttc-light-js
```

## Cloud Run Infrastructure

```bash
# List services
gcloud run services list --region=us-central1 --project=tttc-light-js

# Check service config
gcloud run services describe ts-server-brandon --region=us-central1 --project=tttc-light-js

# List revisions
gcloud run revisions list --service=ts-server-brandon --region=us-central1

# Check environment variables
gcloud run services describe ts-server-brandon --region=us-central1 --format='yaml(spec.template.spec.containers[0].env)'
```

## Rate Limiting

**View rate limit state in Redis:**
```bash
redis-cli KEYS "*rate-limit*"
redis-cli GET "prod-rate-limit-auth:1.2.3.4"
```

**Search logs for rate limit events:**
```bash
pnpm logs server prod --since 1h > /tmp/logs.json
grep "rate limit" /tmp/logs.json
```

## Legacy Report Migration

Migrate reports from GCS to Firestore:

```bash
# Dry run first
pnpm -F utils migrate-legacy -- --dry-run "bucket/file.json"

# Actually migrate
pnpm -F utils migrate-legacy -- "bucket/file.json"
```

**Prerequisites:**
1. Create owner user in Firebase Console
2. Add `LEGACY_REPORT_USER_ID=<uid>` to `express-server/.env`

## Firestore Debugging

General-purpose Firestore CLI (JSON output by default, optimized for Claude Code):

```bash
# Report lookup (includes GCS check, format detection)
pnpm -F utils firestore report <reportId>
pnpm -F utils firestore report <reportId> --env prod

# Download report JSON from GCS
pnpm -F utils firestore download <reportId>
pnpm -F utils firestore download <reportId> --out /tmp/report.json

# Any document by collection/id
pnpm -F utils firestore doc <collection> <docId>

# User lookup
pnpm -F utils firestore user <userId>

# Job lookup
pnpm -F utils firestore job <jobId>

# List documents in collection
pnpm -F utils firestore list reportRef --limit 20
```

**Options:**
- `--env prod|dev` - Target environment (default: dev)
- `--pretty` - Human-readable output instead of JSON
- `--out <path>` - Save download to file instead of stdout
- `--limit N` - Limit results for list command

**Exit codes:** 0=success, 1=not found, 2=error

**Prerequisites:**
- `FIREBASE_CREDENTIALS_ENCODED` in `express-server/.env`
- `GOOGLE_CREDENTIALS_ENCODED` in `express-server/.env` (for GCS checks)

## Direct gcloud Logging

For complex queries:
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="ts-server-brandon" AND jsonPayload.msg=~"rate limit"' --project=tttc-light-js --limit=100 --format=json
```
