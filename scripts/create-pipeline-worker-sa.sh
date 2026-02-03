#!/bin/bash
set -e

# Script to create a service account for pipeline-worker with necessary permissions
# Usage: ./scripts/create-pipeline-worker-sa.sh [PROJECT_ID] [BUCKET_NAME]

PROJECT_ID=${1:-tttc-light-js}
BUCKET_NAME=${2:-tttc-light-dev}
SA_NAME="pipeline-worker"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Creating service account for pipeline-worker..."
echo "Project: $PROJECT_ID"
echo "Bucket: $BUCKET_NAME"
echo "Service Account: $SA_EMAIL"
echo ""

# Create the service account
echo "Creating service account..."
gcloud iam service-accounts create $SA_NAME \
  --display-name="Pipeline Worker Service Account" \
  --description="Service account for pipeline-worker to access GCS, Firestore, and Pub/Sub" \
  --project=$PROJECT_ID || echo "Service account already exists"

# Grant Pub/Sub Subscriber role (to receive messages)
echo "Granting Pub/Sub Subscriber role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/pubsub.subscriber" \
  --condition=None

# Grant Cloud Datastore User role (for Firestore read/write)
echo "Granting Cloud Datastore User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/datastore.user" \
  --condition=None

# Grant Storage Object Admin role on the bucket (to read/write report files)
echo "Granting Storage Object Admin role on bucket $BUCKET_NAME..."
gsutil iam ch "serviceAccount:$SA_EMAIL:roles/storage.objectAdmin" \
  "gs://$BUCKET_NAME"

# Also grant Storage Legacy Bucket Reader for bucket metadata access
echo "Granting Storage Legacy Bucket Reader role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.legacyBucketReader" \
  --condition=None

echo ""
echo "Service account created successfully!"
echo ""
echo "Service Account Email: $SA_EMAIL"
echo ""
echo "Roles granted:"
echo "  - roles/pubsub.subscriber (project-level)"
echo "  - roles/datastore.user (project-level)"
echo "  - roles/storage.objectAdmin (bucket: $BUCKET_NAME)"
echo "  - roles/storage.legacyBucketReader (project-level)"
echo ""
echo "To generate a key for this service account (for local development):"
echo "  gcloud iam service-accounts keys create pipeline-worker-key.json \\"
echo "    --iam-account=$SA_EMAIL \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "To encode the key for use in environment variables:"
echo "  base64 -w 0 pipeline-worker-key.json"
echo ""
echo "To update the Google credentials secret (for GCS access):"
echo "  gcloud secrets versions add google-credentials \\"
echo "    --data-file=<(base64 -w 0 pipeline-worker-key.json) \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "To update the Firebase credentials secret (for Firestore access):"
echo "  gcloud secrets versions add firebase-credentials \\"
echo "    --data-file=<(base64 -w 0 pipeline-worker-key.json) \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "For Cloud Run deployment, assign this service account to the service:"
echo "  gcloud run services update pipeline-worker \\"
echo "    --service-account=$SA_EMAIL \\"
echo "    --region=us-central1 \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "Note: If using explicit credentials (secrets), the Cloud Run service account"
echo "can be the default compute service account. If using Application Default Credentials,"
echo "assign the pipeline-worker service account to the Cloud Run service."
