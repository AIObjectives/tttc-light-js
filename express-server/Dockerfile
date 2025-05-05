# Stage 1: Install dependencies and build
FROM node:18-slim AS build

WORKDIR /usr/src/app

# Copy package.json and package-lock.json to cache dependency layers first
COPY ./common/package*.json ./common/
COPY express-server/package*.json ./express-server/
RUN npm install --prefix ./common
RUN npm install --prefix ./express-server

COPY common/ ./common/
COPY express-server/ ./express-server/
RUN npm run build --prefix ./common
RUN npm run build --prefix ./express-server

# Stage 2: Production image
FROM node:18-slim

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/express-server/package*.json ./
RUN npm install --only=production

COPY --from=build /usr/src/app/express-server/ ./
COPY --from=build /usr/src/app/common ./node_modules/tttc-common

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK CMD curl --fail http://localhost:8080/ || exit 1

RUN useradd --user-group --create-home --shell /bin/false appuser
USER appuser

CMD ["npm", "start"]
