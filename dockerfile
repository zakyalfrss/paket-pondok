FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/ ./

# Install dependencies
RUN npm install

# Install MySQL client untuk health check
RUN apk add --no-cache mysql-client

# Create directory for frontend
RUN mkdir -p ../frontend

# Copy frontend files
COPY frontend/ ../frontend/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node health-check.js

# Start application
CMD ["node", "server.js"]