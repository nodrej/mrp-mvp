# Database Fix Instructions for Proxmox Docker Deployment

## Problem
The Docker backend container cannot access the SQLite database file due to volume mount permission issues in the LXC container environment.

## Solution
Copy the database directly into the Docker container using `docker cp` instead of relying on volume mounts.

---

## Steps to Fix

### 1. Transfer the Fix Script to Proxmox

Since SSH is not configured on your LXC container, use Proxmox's `pct push` command from your Windows machine:

**Option A: Using Proxmox Web Interface (Easier)**
1. Open Proxmox web interface
2. Select your LXC container (ID 103)
3. Go to "Console"
4. Login as root
5. Run these commands in the console:

```bash
cd ~/mrp-mvp
cat > fix_database_docker.sh << 'EOFSCRIPT'
[Copy the entire contents of fix_database_docker.sh here]
EOFSCRIPT
chmod +x fix_database_docker.sh
```

**Option B: Using Command Line**
From your Proxmox host (not the LXC container), run:
```bash
# Copy the script to the container
pct push 103 fix_database_docker.sh /root/mrp-mvp/fix_database_docker.sh

# Make it executable
pct exec 103 -- chmod +x /root/mrp-mvp/fix_database_docker.sh
```

### 2. Run the Fix Script

In the LXC container console (as root):

```bash
cd ~/mrp-mvp
./fix_database_docker.sh
```

### 3. What the Script Does

The script will:
1. Stop the backend container
2. Remove the backend container (not the image)
3. Rebuild the backend with proper directory permissions
4. Start the backend container
5. Copy your database file (`~/mrp-mvp/data/mrp.db`) directly into the container
6. Set proper permissions inside the container
7. Restart the backend
8. Verify the database is accessible and run integrity check

### 4. Verify Success

After running the script, check:

1. **Container Status:**
   ```bash
   docker compose ps
   ```
   Both containers should show "Up" status

2. **Backend Logs:**
   ```bash
   docker compose logs backend | tail -50
   ```
   Should show "Application startup complete" without errors

3. **Access Application:**
   - Frontend: http://192.168.1.18:8080
   - Backend API: http://192.168.1.18:8001
   - API Docs: http://192.168.1.18:8001/docs

---

## If Still Having Issues

### Check Database File Exists
```bash
ls -lh ~/mrp-mvp/data/mrp.db
```

### Verify Database Inside Container
```bash
docker exec mrp-backend ls -lh /app/data/
docker exec mrp-backend sqlite3 /app/data/mrp.db "SELECT COUNT(*) FROM products;"
```

### Check Logs in Real-Time
```bash
docker compose logs -f backend
```

### Manual Database Copy (Alternative Method)
If the script fails, try manually:

```bash
# Stop backend
docker compose stop backend

# Start backend without database
docker compose up -d backend

# Copy database
docker cp ~/mrp-mvp/data/mrp.db mrp-backend:/app/data/mrp.db

# Fix permissions
docker exec mrp-backend chmod 666 /app/data/mrp.db

# Restart
docker compose restart backend
```

---

## Why This Approach Works

The volume mount approach (`./data:/app/data` in docker-compose.yml) doesn't work in your LXC environment due to AppArmor/namespace restrictions. By using `docker cp`, we bypass the volume mount entirely and copy the file directly into the container's filesystem, which avoids permission issues.

---

## Future Database Updates

After this fix, the database inside the container is independent from the host file. To update it:

### Backup Current Database
```bash
docker cp mrp-backend:/app/data/mrp.db ~/mrp-mvp/data/mrp_backup_$(date +%Y%m%d_%H%M%S).db
```

### Update Database in Container
```bash
docker cp ~/mrp-mvp/data/mrp.db mrp-backend:/app/data/mrp.db
docker compose restart backend
```

### Export Database from Container
```bash
docker cp mrp-backend:/app/data/mrp.db ~/mrp-mvp/data/mrp_export.db
```

---

## Long-Term Solution

For production use, consider:
1. **Move to PostgreSQL** - Better suited for containerized deployments
2. **Use a VM instead of LXC** - VMs don't have the same volume mount restrictions
3. **Enable Docker volume plugins** - More advanced mounting options
4. **Database as separate container** - Run PostgreSQL/MySQL in its own container

---

## Contact

If you continue to have issues after running this script, please provide:
1. Output from `docker compose ps`
2. Output from `docker compose logs backend --tail=100`
3. Output from `ls -lh ~/mrp-mvp/data/`
