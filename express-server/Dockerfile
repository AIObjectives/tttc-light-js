

FROM node:18-slim


# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy the packages from common and express
COPY ./common/package*.json ./common/
COPY express-server/package*.json ./express-server/

# Install common packages including development dependencies
WORKDIR /usr/src/app/common
RUN npm install --only=production
RUN npm install typescript @types/node vite rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs rollup-plugin-typescript2 --save-dev

# Move contents of common into docker image before express
WORKDIR /usr/src/app
COPY ./common ./common

# Build common
WORKDIR /usr/src/app/common
RUN npm run build

# Install express packages including development dependencies
WORKDIR /usr/src/app/express-server
RUN npm install --only=production
RUN npm install @babel/cli @babel/core @babel/preset-env @babel/preset-typescript @babel/plugin-transform-modules-commonjs babel-plugin-module-resolver prettier @types/node --save-dev

# Copy express contents 
WORKDIR /usr/src/app
COPY ./express-server ./express-server

# Build express app
WORKDIR /usr/src/app/express-server
RUN npm run build

# Expose port 8080 to the Docker daemon, since Cloud Run only listens on this port.
EXPOSE 8080

WORKDIR /usr/src/app/express-server
# Run the web service on container startup.
CMD [ "npm", "start" ]

