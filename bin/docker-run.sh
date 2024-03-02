docker run \
    -v ./google-credentials.json:/tmp/keys/google-credentials.json \
    --env-file .env \
    -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/keys/google-credentials.json \
    -p 8080:8080 \
    tttc-light-js
