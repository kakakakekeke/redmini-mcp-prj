# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications and install all dependencies (including devDependencies)
COPY package.json package-lock.json ./
RUN npm ci

# Copy TypeScript configuration and source files
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript (generates dist/)
RUN npm run build

# Stage 2: Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production \
    TRANSPORT=sse \
    PORT=3000

# Copy dependency specifications and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Run as non-root user for security
USER node

# Expose SSE transport port
EXPOSE 3000

# Container healthcheck for SSE endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/mcp/sse').catch(() => process.exit(1))"

# Start the MCP server
CMD ["node", "dist/index.js"]
