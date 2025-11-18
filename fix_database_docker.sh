#!/bin/bash
# Script to fix database access in Docker container
# Run this script on the Proxmox container as root

set -e

echo "=== MRP Docker Database Fix Script ==="
echo ""

# Navigate to project directory
cd ~/mrp-mvp

# Stop all containers
echo "1. Stopping all containers..."
docker compose down

# Remove old images to force rebuild
echo "2. Removing old backend image..."
docker rmi mrp-backend-custom 2>/dev/null || true
docker rmi mrp-mvp-backend 2>/dev/null || true

# Create the data directory in the container image
echo "3. Rebuilding backend with proper permissions..."
cat > backend/Dockerfile.tmp << 'EOF'
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && \
    apt-get install -y gcc sqlite3 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory with proper permissions
RUN mkdir -p /app/data && \
    chmod 777 /app/data

EXPOSE 8000

CMD ["python", "main.py"]
EOF

# Rebuild backend with new Dockerfile
docker build -f backend/Dockerfile.tmp -t mrp-backend-custom backend/

# Update docker-compose to use custom image
echo "4. Updating docker-compose configuration..."
cat > docker-compose.override.yml << 'EOF'
version: '3.8'

services:
  backend:
    image: mrp-backend-custom
    build:
      context: ./backend
      dockerfile: Dockerfile.tmp
EOF

# Start the backend container
echo "5. Starting backend container..."
docker compose up -d backend

# Wait for container to start
sleep 3

# Check if database file exists
if [ -f ~/mrp-mvp/data/mrp.db ]; then
    echo "6. Copying database file into container..."
    docker cp ~/mrp-mvp/data/mrp.db mrp-backend:/app/data/mrp.db

    # Fix permissions inside container
    echo "7. Setting permissions inside container..."
    docker exec mrp-backend chmod 666 /app/data/mrp.db
    docker exec mrp-backend chown root:root /app/data/mrp.db

    echo "8. Restarting backend to load database..."
    docker compose restart backend

    # Check status
    sleep 5
    echo ""
    echo "=== Container Status ==="
    docker compose ps

    echo ""
    echo "=== Recent Backend Logs ==="
    docker compose logs --tail=30 backend

    echo ""
    echo "Database fix complete! Check the logs above for any errors."
else
    echo "ERROR: Database file not found at ~/mrp-mvp/data/mrp.db"
    exit 1
fi

echo ""
echo "=== Verification ==="
echo "Database file in container:"
docker exec mrp-backend ls -lh /app/data/
echo ""
echo "Database integrity check:"
docker exec mrp-backend sqlite3 /app/data/mrp.db "PRAGMA integrity_check;"

echo ""
echo "=== Next Steps ==="
echo "If the backend is running successfully:"
echo "  - Frontend: http://192.168.1.18:8080"
echo "  - Backend API: http://192.168.1.18:8001"
echo "  - API Docs: http://192.168.1.18:8001/docs"
echo ""
echo "If still having issues, check logs with:"
echo "  docker compose logs -f backend"
