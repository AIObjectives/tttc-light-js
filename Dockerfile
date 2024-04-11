# Use the official lightweight Node.js 16 image.
# https://hub.docker.com/_/node
FROM node:16-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# copy the packages from common and express
COPY ./common/package*.json ./common/
COPY ./express-pipeline/package*.json ./express-pipeline/

# npm install common before express
WORKDIR /usr/src/app/common
RUN npm install --only=production

# move contents of common into docker image before express
WORKDIR /usr/src/app
COPY ./common ./common

# build common
WORKDIR /usr/src/app/common
RUN npm run build

# install express packages
WORKDIR /usr/src/app/express-pipeline
RUN npm install --only-production

# copy express contents 
WORKDIR /usr/src/app
COPY ./express-pipeline ./express-pipeline

# build express app
WORKDIR /usr/src/app/express-pipeline
RUN npm run build

# # Expose port 8080 to the Docker daemon, since Cloud Run only listens on this port.
EXPOSE 8080

WORKDIR /usr/src/app/express-pipeline
# # Run the web service on container startup.
CMD [ "npm", "start" ]
