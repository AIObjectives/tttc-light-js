#!/bin/bash
set -e

# Script to create a service account for pipeline-worker with necessary permissions
# Usage: ./scripts/create-pipeline-worker-sa.sh [PROJECT_ID] [BUCKET_NAME]

PROJECT_ID=${1:-tttc-light-js}
BUCKET_NAME=${2:-tttc-light-prod}
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

# Grant Pub/Sub Viewer role (to verify subscriptions exist)
echo "Granting Pub/Sub Viewer role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/pubsub.viewer" \
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
echo "  - roles/pubsub.viewer (project-level)"
echo "  - roles/datastore.user (project-level)"
echo "  - roles/storage.objectAdmin (bucket: $BUCKET_NAME)"
echo "  - roles/storage.legacyBucketReader (project-level)"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Update Cloud Run services to use this service account:"
echo "   gcloud run services update pipeline-worker \\"
echo "     --service-account=$SA_EMAIL \\"
echo "     --region=us-central1 \\"
echo "     --project=$PROJECT_ID"
echo ""
echo "2. Update deploy/cloudrun/pipeline-worker.yaml:"
echo "   Change serviceAccountName to: $SA_EMAIL"
echo ""
echo "3. The pipeline-worker will use Application Default Credentials"
echo "   (no explicit credentials or secrets needed)"
