# Stage 1: Install dependencies and build
FROM node:18-slim AS build

WORKDIR /usr/src/app

# Copy package.json and package-lock.json to cache dependency layers first
COPY common/package*.json ./common/
COPY next-client/package*.json ./next-client/
RUN npm install --prefix ./common
RUN npm install --prefix ./next-client

COPY common/ ./common/
COPY next-client/ ./next-client/

RUN npm run build --prefix ./common
RUN npm run build --prefix ./next-client

# Stage 2: Production image
FROM node:18-slim

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/next-client/package*.json ./
RUN npm install --only=production

COPY --from=build /usr/src/app/next-client/.next ./.next
COPY --from=build /usr/src/app/next-client/public ./public
COPY --from=build /usr/src/app/next-client/next.config.js ./next.config.js

COPY --from=build /usr/src/app/common ./node_modules/tttc-common

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK CMD curl --fail http://localhost:3000/ || exit 1

RUN useradd --user-group --create-home --shell /bin/false appuser
USER appuser

CMD ["npm", "start"]
