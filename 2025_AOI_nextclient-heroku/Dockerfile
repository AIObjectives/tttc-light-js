# # Dockerfile content
# # Stage 1: Install dependencies and build
# FROM node:18-slim AS build

# # Create and change to the app directory.
# WORKDIR /usr/src/app

# # Copy package.json and package-lock.json for next-client
# COPY next-client/package*.json ./next-client/

# # Copy package.json and package-lock.json for common
# COPY common/package*.json ./common/

# # Install dependencies for common
# WORKDIR /usr/src/app/common
# RUN npm install

# # Install dependencies for next-client
# WORKDIR /usr/src/app/next-client

# # Install remaining dependencies
# RUN npm install

# # Copy the rest of the application code for next-client
# COPY next-client/ ./

# # Copy the rest of the application code for common
# COPY common/ ../common/

# # Build the Next.js client
# RUN npm run build

# # Stage 2: Production image
# FROM node:18-slim

# # Create and change to the app directory.
# WORKDIR /usr/src/app

# # Copy only the production dependencies for next-client
# COPY --from=build /usr/src/app/next-client/package*.json ./
# RUN npm install --only=production

# # Copy the build output and other necessary files from the build stage
# COPY --from=build /usr/src/app/next-client/.next ./.next
# COPY --from=build /usr/src/app/next-client/public ./public
# COPY --from=build /usr/src/app/next-client/next.config.js ./next.config.js

# # Copy the common directory
# COPY --from=build /usr/src/app/common ../common/

# # Expose port 3000
# EXPOSE 3000

# # Set the environment variable for the port
# ENV PORT=3000

# # Run the Next.js client on container startup.
# CMD ["npm", "start"]





######



############# MINI GAME UPDATE DOCKER FILE if doesnt work try the old one

# Stage 1: Build
FROM node:18-slim AS build

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json for next-client
COPY next-client/package*.json ./next-client/

# Copy package.json and package-lock.json for common
COPY common/package*.json ./common/

# Install dependencies for common
WORKDIR /usr/src/app/common
RUN npm install --legacy-peer-deps

# Install dependencies for next-client
WORKDIR /usr/src/app/next-client
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY next-client/ ./
COPY common/ ../common/

# Build the Next.js app
RUN npm run build

# Stage 2: Production image
FROM node:18-slim

# Set working directory
WORKDIR /usr/src/app

# Copy only the necessary dependencies
COPY --from=build /usr/src/app/next-client/package*.json ./
RUN npm install --only=production --legacy-peer-deps

# Copy the build output and public assets
COPY --from=build /usr/src/app/next-client/.next ./.next
COPY --from=build /usr/src/app/next-client/public ./public
COPY --from=build /usr/src/app/next-client/next.config.js ./next.config.js

# Copy the common directory
COPY --from=build /usr/src/app/common ../common/

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000

# Run Next.js
CMD ["npm", "start"]
