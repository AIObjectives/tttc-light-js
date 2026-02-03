# Pipeline Worker Service Account Setup - Quick Start

This guide walks you through creating a dedicated service account for the pipeline-worker with proper permissions.

## Why This Is Needed

The pipeline-worker needs access to:
- **Google Cloud Storage** - Read/write report JSON files
- **Firestore** - Read/write report metadata and job status
- **Pub/Sub** - Receive pipeline job messages

Previously, it was using a service account from a different project which caused permission errors.

## Setup Steps

### 1. Create the Service Account

Run the automated setup script:

```bash
./scripts/create-pipeline-worker-sa.sh
```

Or specify custom project/bucket:

```bash
./scripts/create-pipeline-worker-sa.sh tttc-light-js tttc-light-prod
```

This creates a service account named `pipeline-worker@tttc-light-js.iam.gserviceaccount.com` with:
- `roles/pubsub.subscriber` (project-level)
- `roles/datastore.user` (project-level)
- `roles/storage.objectAdmin` (on bucket)
- `roles/storage.legacyBucketReader` (project-level)

### 2. Verify the YAML Configuration

The deployment YAML has already been updated:

```yaml
# deploy/cloudrun/pipeline-worker.yaml
serviceAccountName: pipeline-worker@tttc-light-js.iam.gserviceaccount.com
```

Note: `GOOGLE_CREDENTIALS_ENCODED` has been removed - the service uses Application Default Credentials now.

### 3. Deploy

The next time you deploy (via GitHub Actions or manually), the pipeline-worker will:
1. Use the new service account identity
2. Automatically authenticate to GCS, Firestore, and Pub/Sub
3. No longer need explicit credential secrets

## How It Works

The pipeline-worker uses **Application Default Credentials (ADC)**:
- In Cloud Run: Uses the service account assigned to the Cloud Run service
- Locally: Uses `gcloud auth application-default login`

No explicit credentials or secrets needed!

## Verification

After deployment, check the logs:

```bash
pnpm logs pyserver staging --since 5m
```

You should see:
```
Initializing GCS with Application Default Credentials
GCS health check passed
```

## Troubleshooting

If you see permission errors:

1. **Verify service account exists**:
   ```bash
   gcloud iam service-accounts describe pipeline-worker@tttc-light-js.iam.gserviceaccount.com \
     --project=tttc-light-js
   ```

2. **Check IAM bindings**:
   ```bash
   gcloud projects get-iam-policy tttc-light-js \
     --flatten="bindings[].members" \
     --filter="bindings.members:pipeline-worker@tttc-light-js.iam.gserviceaccount.com"
   ```

3. **Check bucket permissions**:
   ```bash
   gsutil iam get gs://tttc-light-prod | grep pipeline-worker
   ```

4. **Verify Cloud Run is using the service account**:
   ```bash
   gcloud run services describe pipeline-worker \
     --region=us-central1 \
     --project=tttc-light-js \
     --format='value(spec.template.spec.serviceAccountName)'
   ```

## More Details

See `scripts/PIPELINE_WORKER_SA.md` for comprehensive documentation.
