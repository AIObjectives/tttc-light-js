# Dockerfile content
# Stage 1: Install dependencies and build
FROM node:18-slim AS build

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json for next-client
COPY next-client/package*.json ./next-client/

# Copy package.json and package-lock.json for common
COPY common/package*.json ./common/

# Install dependencies for common
WORKDIR /usr/src/app/common
RUN npm install

# Install dependencies for next-client
WORKDIR /usr/src/app/next-client

# Install remaining dependencies
RUN npm install

# Copy the rest of the application code for next-client
COPY next-client/ ./

# Copy the rest of the application code for common
COPY common/ ../common/

# Build the Next.js client
RUN npm run build

# Stage 2: Production image
FROM node:18-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy only the production dependencies for next-client
COPY --from=build /usr/src/app/next-client/package*.json ./
RUN npm install --only=production

# Copy the build output and other necessary files from the build stage
COPY --from=build /usr/src/app/next-client/.next ./.next
COPY --from=build /usr/src/app/next-client/public ./public
COPY --from=build /usr/src/app/next-client/next.config.js ./next.config.js

# Copy the common directory
COPY --from=build /usr/src/app/common ../common/

# Expose port 3000
EXPOSE 3000

# Set the environment variable for the port
ENV PORT=3000

# Run the Next.js client on container startup.
CMD ["npm", "start"]