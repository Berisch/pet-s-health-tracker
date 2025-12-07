# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies
RUN npm ci --workspace=server
RUN npm ci --workspace=client

# Copy source code
COPY server ./server
COPY client ./client

# Build client
WORKDIR /app/client
RUN npm run build

# Build server
WORKDIR /app/server
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy server build and package files
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/

# Copy client build
COPY --from=builder /app/client/build ./client/build

# Install production dependencies only
WORKDIR /app/server
RUN npm ci --omit=dev

# Create data directory
RUN mkdir -p /app/server/data

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# Run the server
CMD ["node", "dist/index.js"]
