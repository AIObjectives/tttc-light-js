# Stage 1: Install dependencies and build
FROM node:24-slim AS build

WORKDIR /usr/src/app

# Copy package.json and package-lock.json to cache dependency layers first
COPY ./common/package*.json ./common/
COPY pipeline-worker/package*.json ./pipeline-worker/
RUN npm install --prefix ./common
RUN npm install --prefix ./pipeline-worker

COPY common/ ./common/
COPY pipeline-worker/ ./pipeline-worker/
RUN npm run build --prefix ./common
RUN npm run build --prefix ./pipeline-worker

# Stage 2: Production image
FROM node:24-slim

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/pipeline-worker/package*.json ./
RUN npm install --only=production

COPY --from=build /usr/src/app/pipeline-worker/ ./
COPY --from=build /usr/src/app/common ./node_modules/tttc-common

ENV NODE_ENV=production

RUN useradd --user-group --create-home --shell /bin/false appuser
USER appuser

CMD ["node", "dist/index.js"]
