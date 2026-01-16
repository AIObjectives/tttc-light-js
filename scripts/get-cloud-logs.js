#!/usr/bin/env node

/**
 * Cloud Run Log Fetching Utility
 *
 * Fetches logs from Cloud Run services with simple aliases and filters.
 * Designed for Claude Code and developer debugging workflows.
 *
 * Usage:
 *   node scripts/get-cloud-logs.js <service> <environment> [options]
 *
 * Examples:
 *   node scripts/get-cloud-logs.js server staging
 *   node scripts/get-cloud-logs.js pyserver prod --errors --since 2h
 *   node scripts/get-cloud-logs.js server ephemeral --pr 123
 *
 * Options:
 *   --since <duration>   Time window (e.g., 30m, 2h, 1d). Default: 30m
 *   --from <timestamp>   Start time (ISO 8601)
 *   --to <timestamp>     End time (ISO 8601)
 *   --errors             Only show ERROR and higher severity
 *   --request-id <id>    Filter by correlation/request ID (distributed tracing)
 *   --limit <n>          Max entries to fetch. Default: 500
 *   --pr <number>        PR number for ephemeral environments
 *   --help               Show this help message
 */

import { execSync } from "child_process";

// Service name mappings by environment
// Note: Naming conventions are inconsistent across environments
const SERVICE_NAMES = {
  server: {
    staging: "stage-t3c-express-server",
    prod: "ts-server-brandon",
    ephemeral: (pr) => `dev-t3c-express-server-pr-${pr}`,
  },
  pyserver: {
    staging: "stage-t3c-pyserver",
    prod: "pyserver-brandon",
    ephemeral: (pr) => `dev-pyserver-pr-${pr}`,
  },
  client: {
    staging: "t3c-next-client-staging",
    prod: "t3c-next-client",
    ephemeral: (pr) => `dev-t3c-next-client-pr-${pr}`,
  },
};

const PROJECT_ID = "tttc-light-js";
const REGION = "us-central1";

/**
 * Parse duration string to milliseconds
 * @param {string} duration - e.g., "30m", "2h", "1d"
 * @returns {number} milliseconds
 */
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(
      `Invalid duration format: ${duration}. Use format like 30m, 2h, or 1d`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

// Argument definitions: flag -> { key, hasValue, transform? }
const ARG_DEFINITIONS = {
  "--help": { key: "help", hasValue: false },
  "-h": { key: "help", hasValue: false },
  "--since": { key: "since", hasValue: true },
  "--from": { key: "from", hasValue: true },
  "--to": { key: "to", hasValue: true },
  "--errors": { key: "errors", hasValue: false, value: true },
  "--request-id": { key: "requestId", hasValue: true },
  "--rid": { key: "requestId", hasValue: true },
  "--limit": { key: "limit", hasValue: true, transform: (v) => parseInt(v, 10) },
  "--pr": { key: "pr", hasValue: true },
};

/**
 * Handle positional arguments (service and environment)
 */
function handlePositionalArg(options, arg) {
  if (!options.service) {
    options.service = arg;
  } else if (!options.environment) {
    options.environment = arg;
  }
}

/**
 * Parse command line arguments using declarative definitions
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    service: null,
    environment: null,
    since: "30m",
    from: null,
    to: null,
    errors: false,
    requestId: null,
    limit: 500,
    pr: null,
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    const def = ARG_DEFINITIONS[arg];

    if (def) {
      const rawValue = def.hasValue ? args[++i] : (def.value ?? true);
      options[def.key] = def.transform ? def.transform(rawValue) : rawValue;
    } else if (!arg.startsWith("--")) {
      handlePositionalArg(options, arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
    i++;
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Cloud Run Log Fetching Utility

Usage:
  node scripts/get-cloud-logs.js <service> <environment> [options]
  pnpm logs <service> <environment> [options]

Services:
  server    Express server (API backend)
  pyserver  Python server (LLM processing)
  client    Next.js client (frontend)

Environments:
  staging   Staging environment
  prod      Production environment
  ephemeral PR preview environment (requires --pr)

Options:
  --since <duration>   Time window (e.g., 30m, 2h, 1d). Default: 30m
  --from <timestamp>   Start time (ISO 8601 format)
  --to <timestamp>     End time (ISO 8601 format)
  --errors             Only show ERROR and higher severity
  --request-id <id>    Filter by correlation ID (--rid alias)
  --limit <n>          Max entries to fetch. Default: 500
  --pr <number>        PR number for ephemeral environments
  --help               Show this help message

Examples:
  # Get last 30 minutes of staging server logs
  pnpm logs server staging

  # Get last 2 hours of production pyserver errors
  pnpm logs pyserver prod --errors --since 2h

  # Get logs for a specific time range
  pnpm logs server prod --from "2025-01-05T10:00:00Z" --to "2025-01-05T12:00:00Z"

  # Get ephemeral environment logs for PR #123
  pnpm logs server ephemeral --pr 123

  # Trace a request across services by correlation ID
  pnpm logs server prod --request-id "abc123-def456"

Service Name Mappings:
  ┌──────────┬───────────────────────────┬──────────────────────┬────────────────────────────────┐
  │ Alias    │ Staging                   │ Production           │ Ephemeral                      │
  ├──────────┼───────────────────────────┼──────────────────────┼────────────────────────────────┤
  │ server   │ stage-t3c-express-server  │ ts-server-brandon    │ dev-t3c-express-server-pr-{N}  │
  │ pyserver │ stage-t3c-pyserver        │ pyserver-brandon     │ dev-pyserver-pr-{N}            │
  │ client   │ t3c-next-client-staging   │ t3c-next-client      │ dev-t3c-next-client-pr-{N}     │
  └──────────┴───────────────────────────┴──────────────────────┴────────────────────────────────┘
`);
}

/**
 * Resolve service name from alias and environment
 */
function resolveServiceName(service, environment, pr) {
  const serviceConfig = SERVICE_NAMES[service];
  if (!serviceConfig) {
    console.error(
      `Unknown service: ${service}. Valid services: ${Object.keys(SERVICE_NAMES).join(", ")}`,
    );
    process.exit(1);
  }

  if (environment === "ephemeral") {
    if (!pr) {
      console.error("Ephemeral environment requires --pr <number>");
      process.exit(1);
    }
    return serviceConfig.ephemeral(pr);
  }

  const serviceName = serviceConfig[environment];
  if (!serviceName) {
    console.error(
      `Unknown environment: ${environment}. Valid environments: staging, prod, ephemeral`,
    );
    process.exit(1);
  }

  return serviceName;
}

/**
 * Build gcloud logging filter
 */
function buildFilter(serviceName, options) {
  const filters = [
    `resource.type="cloud_run_revision"`,
    `resource.labels.service_name="${serviceName}"`,
  ];

  // Time range
  if (options.from && options.to) {
    filters.push(`timestamp>="${options.from}"`);
    filters.push(`timestamp<="${options.to}"`);
  } else {
    const durationMs = parseDuration(options.since);
    const startTime = new Date(Date.now() - durationMs).toISOString();
    filters.push(`timestamp>="${startTime}"`);
  }

  // Severity filter
  if (options.errors) {
    filters.push(`severity>=ERROR`);
  }

  // Request/correlation ID filter (for distributed tracing)
  if (options.requestId) {
    filters.push(`jsonPayload.requestId="${options.requestId}"`);
  }

  return filters.join(" AND ");
}

/**
 * Fetch logs from gcloud
 */
function fetchLogs(serviceName, options) {
  const filter = buildFilter(serviceName, options);

  console.error(`Fetching logs from ${serviceName}...`);
  console.error(`Project: ${PROJECT_ID}, Region: ${REGION}`);
  console.error(`Filter: ${filter}`);
  console.error(`Limit: ${options.limit}\n`);

  const cmd = `gcloud logging read '${filter}' --project=${PROJECT_ID} --limit=${options.limit} --format=json --freshness=7d`;

  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      stdio: ["pipe", "pipe", "pipe"],
    });

    const logs = JSON.parse(output || "[]");
    console.error(`Fetched ${logs.length} log entries\n`);

    return logs;
  } catch (error) {
    console.error("Failed to fetch logs from gcloud:");
    console.error(error.message);
    console.error("\nTroubleshooting:");
    console.error("  1. Ensure you are authenticated: gcloud auth login");
    console.error(
      `  2. Verify project access: gcloud config set project ${PROJECT_ID}`,
    );
    console.error(`  3. Check service exists: gcloud run services list --region=${REGION}`);
    process.exit(1);
  }
}

/**
 * Main execution
 */
function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.service || !options.environment) {
    console.error("Error: service and environment are required\n");
    showHelp();
    process.exit(1);
  }

  const serviceName = resolveServiceName(
    options.service,
    options.environment,
    options.pr,
  );

  const logs = fetchLogs(serviceName, options);

  // Output JSON to stdout (for piping/parsing)
  console.log(JSON.stringify(logs, null, 2));
}

main();
