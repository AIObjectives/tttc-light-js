# -------- Stage 1: Build --------
    FROM node:18-slim AS build

    WORKDIR /app
    
    # Copy and build common
    COPY common/ ./common/
    WORKDIR /app/common
    RUN npm install && npm run build
    
    # Copy next-client
    WORKDIR /app/next-client
    COPY next-client/ ./
    
    # Install next-client deps (will detect tttc-common via file ref)
    RUN npm install
    
    # Build next-client
    RUN npm run build
    
    # -------- Stage 2: Production --------
    FROM node:18-slim
    
    WORKDIR /app
    
    COPY --from=build /app/next-client ./
    COPY --from=build /app/next-client/node_modules ./node_modules
    
    # Production install only
    RUN npm install --omit=dev
    
    EXPOSE 3000
    ENV PORT=3000
    
    CMD ["npm", "start"]



     