# Pipeline Worker Service Account Setup

This document explains how to create and configure a service account for the pipeline-worker with appropriate permissions.

## Quick Start

```bash
# Create service account with default settings
./scripts/create-pipeline-worker-sa.sh

# Or specify project and bucket
./scripts/create-pipeline-worker-sa.sh tttc-light-js tttc-light-dev
```

## Permissions Required

The pipeline-worker needs access to:

1. **Pub/Sub** - To receive pipeline job messages
   - Role: `roles/pubsub.subscriber`

2. **Firestore** - To read/write report metadata and job status
   - Role: `roles/datastore.user`

3. **Cloud Storage** - To read/write report JSON files
   - Role: `roles/storage.objectAdmin` (on specific bucket)
   - Role: `roles/storage.legacyBucketReader` (for bucket metadata)

## Cloud Run Deployment

To use this service account in Cloud Run, update your deployment:

```bash
gcloud run services update pipeline-worker \
  --service-account=pipeline-worker@tttc-light-js.iam.gserviceaccount.com \
  --region=us-central1 \
  --project=tttc-light-js
```

Or update the Cloud Run YAML:

```yaml
spec:
  template:
    spec:
      serviceAccountName: pipeline-worker@tttc-light-js.iam.gserviceaccount.com
```

## Local Development

For local development, you can either:

### Option 1: Use Application Default Credentials (Recommended)

```bash
gcloud auth application-default login
```

This will use your personal credentials with the same permissions.

### Option 2: Use Service Account Key

Generate a key file:

```bash
gcloud iam service-accounts keys create pipeline-worker-key.json \
  --iam-account=pipeline-worker@tttc-light-js.iam.gserviceaccount.com \
  --project=tttc-light-js
```

Encode for environment variable:

```bash
base64 -w 0 pipeline-worker-key.json
```

Add to `pipeline-worker/.env`:

```bash
GOOGLE_CREDENTIALS_ENCODED=<base64-encoded-key>
FIREBASE_CREDENTIALS_ENCODED=<base64-encoded-key>
```

**Note**: The same service account key can be used for both GCS and Firestore access.

## Ephemeral Environments

For ephemeral PR environments, update `.github/workflows/ephemeral-deploy.yml` to use this service account:

```yaml
- name: Deploy Pipeline Worker
  run: |
    gcloud run deploy pipeline-worker-pr-${{ github.event.pull_request.number }} \
      --service-account=pipeline-worker@tttc-light-js.iam.gserviceaccount.com \
      # ... other flags
```

## Verification

After creating the service account and deploying, verify it has the correct permissions:

```bash
# Check IAM bindings
gcloud projects get-iam-policy tttc-light-js \
  --flatten="bindings[].members" \
  --filter="bindings.members:pipeline-worker@tttc-light-js.iam.gserviceaccount.com"

# Check bucket permissions
gsutil iam get gs://tttc-light-dev | grep pipeline-worker
```

## Troubleshooting

### Permission Denied on GCS

If you see `does not have storage.buckets.get access`, ensure:
1. The service account has `roles/storage.legacyBucketReader` at project level
2. The service account has `roles/storage.objectAdmin` on the specific bucket

### Permission Denied on Firestore

If you see Firestore permission errors, ensure:
1. The service account has `roles/datastore.user` at project level
2. Firestore security rules allow the service account access

### Permission Denied on Pub/Sub

If you see Pub/Sub subscription errors, ensure:
1. The service account has `roles/pubsub.subscriber` at project level
2. The subscription exists and is attached to the correct topic
