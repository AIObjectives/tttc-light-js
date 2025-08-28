#!/bin/bash

# Setup script for ephemeral Cloud Run deployments
# Run this script to configure the necessary GCP resources

PROJECT_ID="tttc-light-js"
REGION="us-central1"
REPO_OWNER="YOUR_GITHUB_ORG"  # Replace with your GitHub org/username
REPO_NAME="YOUR_REPO_NAME"    # Replace with your repo name

echo "Setting up ephemeral deployment infrastructure..."

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com \
  run.googleapis.com \
  clouddeploy.googleapis.com \
  containerregistry.googleapis.com \
  --project=$PROJECT_ID

# Create service account for GitHub Actions
echo "Creating service account for GitHub Actions..."
SA_NAME="github-actions-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create $SA_NAME \
  --display-name="GitHub Actions Deploy Service Account" \
  --project=$PROJECT_ID

# Grant necessary permissions
echo "Granting permissions to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/clouddeploy.admin"

# Create Workload Identity Pool
echo "Creating Workload Identity Pool..."
POOL_ID="github-actions-pool"
PROVIDER_ID="github-actions-provider"

gcloud iam workload-identity-pools create $POOL_ID \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project=$PROJECT_ID

# Create Workload Identity Provider
echo "Creating Workload Identity Provider..."
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID \
  --workload-identity-pool=$POOL_ID \
  --location="global" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --project=$PROJECT_ID

# Bind service account to workload identity
echo "Binding service account to workload identity..."
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud config get-value project --quiet)/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO_OWNER}/${REPO_NAME}" \
  --project=$PROJECT_ID

# Get the Workload Identity Provider name
WIF_PROVIDER=$(gcloud iam workload-identity-pools providers describe $PROVIDER_ID \
  --workload-identity-pool=$POOL_ID \
  --location="global" \
  --format="value(name)" \
  --project=$PROJECT_ID)

echo ""
echo "✅ Setup complete!"
echo ""
echo "Add these secrets to your GitHub repository:"
echo "WIF_PROVIDER: $WIF_PROVIDER"
echo "WIF_SERVICE_ACCOUNT: $SA_EMAIL"
echo ""
echo "Update the following variables in setup-ephemeral-deploy.sh:"
echo "REPO_OWNER: Set to your GitHub organization or username"
echo "REPO_NAME: Set to your repository name"
echo ""
echo "Then re-run this script to complete the setup."