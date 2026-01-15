---
description: Fetch Cloud Run logs for debugging
user-invocable: true
---

# Cloud Logs

Fetch and analyze Cloud Run logs from staging or production environments.

## Usage

When the user invokes `/cloud-logs`, gather the following information:

1. **Service** (required): `server`, `pyserver`, or `client`
2. **Environment** (required): `staging`, `prod`, or `ephemeral` (ephemeral requires PR number)
3. **Time range**: `--since 1h` (default), or specific `--from`/`--to` timestamps
4. **Filters**: `--errors` for errors only, `--request-id <id>` for correlation ID

## Command Format

```bash
pnpm logs <service> <environment> [options]
```

## Common Patterns

**Recent errors in staging:**
```bash
pnpm logs server staging --errors --since 1h
```

**Production pyserver last 2 hours:**
```bash
pnpm logs pyserver prod --since 2h
```

**Specific time range:**
```bash
pnpm logs server prod --from "2026-01-05T10:00:00Z" --to "2026-01-05T12:00:00Z"
```

**Ephemeral PR environment:**
```bash
pnpm logs server ephemeral --pr 123 --since 30m
```

**Filter by correlation ID:**
```bash
pnpm logs server prod --request-id abc123 --since 1h
```

**Save to file for analysis:**
```bash
pnpm logs server staging --since 1h > /tmp/logs.json
```

## Service Mapping

| Alias | Staging Service | Production Service |
|-------|-----------------|-------------------|
| `server` | stage-t3c-express-server | ts-server-brandon |
| `pyserver` | stage-t3c-pyserver | pyserver-brandon |
| `client` | t3c-next-client-staging | t3c-next-client |

## Prerequisites

If the command fails with authentication errors:
```bash
gcloud auth login
gcloud config set project tttc-light-js
```

## Workflow

1. Ask the user which service and environment they want logs from
2. Ask about time range and any filters (errors only, correlation ID)
3. Run the appropriate `pnpm logs` command
4. Analyze the output for errors, patterns, or the specific issue they're debugging
