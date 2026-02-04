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
   - Role: `roles/pubsub.subscriber` (to consume messages)
   - Role: `roles/pubsub.viewer` (to verify subscriptions exist)

2. **Firestore** - To read/write report metadata and job status
   - Role: `roles/datastore.user`

3. **Cloud Storage** - To read/write report JSON files
   - Role: `roles/storage.objectAdmin` (on specific bucket)
   - Role: `roles/storage.legacyBucketReader` (for bucket metadata)

## Cloud Run Deployment

The pipeline-worker uses **Application Default Credentials**, which means it authenticates using the Cloud Run service account identity. No explicit credentials or secrets are needed.

### Update Service Account

```bash
gcloud run services update pipeline-worker \
  --service-account=pipeline-worker@tttc-light-js.iam.gserviceaccount.com \
  --region=us-central1 \
  --project=tttc-light-js
```

### Update Cloud Run YAML

In `deploy/cloudrun/pipeline-worker.yaml`:

```yaml
spec:
  template:
    spec:
      serviceAccountName: pipeline-worker@tttc-light-js.iam.gserviceaccount.com
```

**Important**: Remove any `GOOGLE_CREDENTIALS_ENCODED` environment variables from the deployment. The service will automatically use the service account's credentials.

## Local Development

For local development, use Application Default Credentials:

```bash
gcloud auth application-default login
```

This authenticates using your personal Google Cloud credentials. Make sure your account has the same permissions as the pipeline-worker service account.

## Ephemeral Environments

For ephemeral PR environments, the service account is configured in `deploy/cloudrun/pipeline-worker.yaml`. The GitHub Actions workflow automatically applies this YAML during deployment.

Make sure the `serviceAccountName` in the YAML is set to:
```yaml
serviceAccountName: pipeline-worker@tttc-light-js.iam.gserviceaccount.com
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
