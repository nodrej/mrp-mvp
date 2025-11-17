#!/bin/bash
# Simple script to rebuild backend and copy database
# Run on Proxmox container as root

set -e

echo "=========================================="
echo "MRP Database Fix - Rebuild & Copy Script"
echo "=========================================="
echo ""

cd ~/mrp-mvp

# Stop containers
echo "Step 1: Stopping containers..."
docker compose down

# Pull latest code (if using git)
echo ""
echo "Step 2: Checking for code updates..."
if [ -d .git ]; then
    git pull origin main 2>/dev/null || echo "No git updates available"
else
    echo "Not a git repository, skipping git pull"
fi

# Rebuild backend with updated code
echo ""
echo "Step 3: Rebuilding backend (this may take a minute)..."
docker compose build --no-cache backend

# Start containers
echo ""
echo "Step 4: Starting containers..."
docker compose up -d

# Wait for backend to be ready
echo ""
echo "Step 5: Waiting for backend to start..."
sleep 5

# Check if database file exists on host
if [ -f ~/mrp-mvp/data/mrp.db ]; then
    echo ""
    echo "Step 6: Copying database into container..."
    docker cp ~/mrp-mvp/data/mrp.db mrp-backend:/app/data/mrp.db

    # Set permissions
    echo "Step 7: Setting database permissions..."
    docker exec mrp-backend chmod 666 /app/data/mrp.db

    # Restart backend to reload with database
    echo "Step 8: Restarting backend..."
    docker compose restart backend

    # Wait for restart
    sleep 5

    echo ""
    echo "✓ Database copied successfully!"
else
    echo ""
    echo "⚠ Warning: No database file found at ~/mrp-mvp/data/mrp.db"
    echo "The application will start with an empty database."
fi

echo ""
echo "=========================================="
echo "Deployment Status"
echo "=========================================="
echo ""

# Show container status
docker compose ps

echo ""
echo "=========================================="
echo "Backend Logs (last 40 lines)"
echo "=========================================="
echo ""

# Show recent logs
docker compose logs --tail=40 backend

echo ""
echo "=========================================="
echo "Verification"
echo "=========================================="
echo ""

# Verify database inside container
echo "Database in container:"
docker exec mrp-backend ls -lh /app/data/ 2>/dev/null || echo "Could not list /app/data/"

echo ""
echo "Database integrity check:"
docker exec mrp-backend sqlite3 /app/data/mrp.db "PRAGMA integrity_check;" 2>/dev/null || echo "Could not check database integrity"

echo ""
echo "=========================================="
echo "Access URLs"
echo "=========================================="
echo ""
echo "Frontend: http://192.168.1.18:8080"
echo "Backend API: http://192.168.1.18:8001"
echo "API Docs: http://192.168.1.18:8001/docs"
echo ""
echo "=========================================="
echo ""

# Check if backend is healthy
if docker compose ps | grep -q "mrp-backend.*Up"; then
    echo "✓ Backend is running!"
else
    echo "✗ Backend is not running properly"
    echo ""
    echo "Run this to see full logs:"
    echo "  docker compose logs -f backend"
fi

echo ""
echo "To monitor logs in real-time:"
echo "  docker compose logs -f"
echo ""
