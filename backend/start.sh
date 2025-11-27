#!/bin/bash

echo "🔄 Starting application startup sequence..."

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL database to be ready..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if node health-check.js > /dev/null 2>&1; then
        echo "✅ MySQL is ready!"
        break
    else
        echo "📊 MySQL not ready yet (attempt $attempt/$max_attempts)..."
        sleep 5
    fi
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ MySQL not ready after $max_attempts attempts. Starting anyway..."
fi

echo "🚀 Starting Node.js application..."
echo "📦 Node version: $(node --version)"
echo "📦 NPM version: $(npm --version)"
echo "📦 Current directory: $(pwd)"
echo "📦 Files in current directory:"
ls -la

# Start the application
exec npm start