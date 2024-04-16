# get current project id from gcloud
PROJECT_ID=$(gcloud config get-value project)
# build for linux platform
docker build --platform=linux/amd64 -t gcr.io/$PROJECT_ID/ttc-light-js-app ..
# push to google cloud registry 
docker push gcr.io/$PROJECT_ID/ttc-light-js-app