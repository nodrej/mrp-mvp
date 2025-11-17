# Quick Start - Proxmox Deployment

## The Problem We Fixed

Your `database.py` file was **not reading the `DATABASE_PATH` environment variable** set in docker-compose.yml. I've now fixed it to:
1. Check for the `DATABASE_PATH` environment variable first (for Docker)
2. Fall back to relative path calculation (for local development)
3. Add extensive debugging output to show what's happening

## What Changed

**[backend/database.py](backend/database.py:8-16)** - Now respects the `DATABASE_PATH` environment variable:
```python
DATABASE_PATH_ENV = os.getenv("DATABASE_PATH")
if DATABASE_PATH_ENV:
    DB_PATH = DATABASE_PATH_ENV
    print(f"Using database from environment: {DB_PATH}")
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, "data", "mrp.db")
    print(f"Using database from relative path: {DB_PATH}")
```

**[backend/Dockerfile](backend/Dockerfile:10)** - Added SQLite tools
**[backend/Dockerfile](backend/Dockerfile:23)** - Better permissions on /app/data directory

---

## Deploy to Proxmox in 3 Steps

### Step 1: Transfer Updated Files

You need to get the updated `database.py`, `Dockerfile`, and the rebuild script to your Proxmox container.

**Option A - Use Proxmox Console** (Easiest):

1. Open Proxmox web interface → Your container → Console
2. Login as root
3. Run:
```bash
cd ~/mrp-mvp

# Update database.py with the fix
cat > backend/database.py << 'EOF'
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite database file location
# Use environment variable if set (for Docker), otherwise use relative path
DATABASE_PATH_ENV = os.getenv("DATABASE_PATH")
if DATABASE_PATH_ENV:
    DB_PATH = DATABASE_PATH_ENV
    print(f"Using database from environment: {DB_PATH}")
else:
    # Get the project root directory (one level up from backend)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, "data", "mrp.db")
    print(f"Using database from relative path: {DB_PATH}")

DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
    echo=True  # Log SQL queries (disable in production)
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize database
def init_db():
    """Create all tables"""
    import os

    # Debug information
    print(f"\n=== Database Initialization ===")
    print(f"Database URL: {DATABASE_URL}")
    print(f"Database Path: {DB_PATH}")
    print(f"Database file exists: {os.path.exists(DB_PATH)}")
    if os.path.exists(DB_PATH):
        print(f"Database file size: {os.path.getsize(DB_PATH)} bytes")
        print(f"Database file permissions: {oct(os.stat(DB_PATH).st_mode)[-3:]}")

    # Get the directory of the database file
    db_dir = os.path.dirname(DB_PATH)
    print(f"Database directory: {db_dir}")
    print(f"Database directory exists: {os.path.exists(db_dir)}")
    if os.path.exists(db_dir):
        print(f"Database directory permissions: {oct(os.stat(db_dir).st_mode)[-3:]}")
        print(f"Database directory contents: {os.listdir(db_dir)}")
    print(f"================================\n")

    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully!")
EOF
```

4. Update the Dockerfile:
```bash
# Add sqlite3 to Dockerfile
sed -i 's/gcc \\/gcc \\\n    sqlite3 \\/' backend/Dockerfile

# Fix data directory permissions
sed -i 's/RUN mkdir -p \/app\/data/RUN mkdir -p \/app\/data \&\& chmod 777 \/app\/data/' backend/Dockerfile
```

**Option B - Use Git** (If you pushed to GitHub):
```bash
cd ~/mrp-mvp
git pull origin main
```

### Step 2: Run the Rebuild Script

```bash
cd ~/mrp-mvp

# Create the rebuild script
cat > rebuild_and_copy_db.sh << 'EOFSCRIPT'
#!/bin/bash
set -e
echo "Rebuilding backend and copying database..."
cd ~/mrp-mvp
docker compose down
docker compose build --no-cache backend
docker compose up -d
sleep 5

if [ -f ~/mrp-mvp/data/mrp.db ]; then
    docker cp ~/mrp-mvp/data/mrp.db mrp-backend:/app/data/mrp.db
    docker exec mrp-backend chmod 666 /app/data/mrp.db
    docker compose restart backend
    sleep 5
    echo "✓ Database copied!"
fi

docker compose ps
docker compose logs --tail=40 backend
EOFSCRIPT

# Make executable and run
chmod +x rebuild_and_copy_db.sh
./rebuild_and_copy_db.sh
```

### Step 3: Verify It's Working

The script will show you the status. Look for:
- ✓ "Using database from environment: /app/data/mrp.db"
- ✓ "Database file exists: True"
- ✓ "Application startup complete"

Access your application:
- **Frontend:** http://192.168.1.18:8080
- **Backend API:** http://192.168.1.18:8001
- **API Docs:** http://192.168.1.18:8001/docs

---

## Troubleshooting

### Check Logs
```bash
docker compose logs -f backend
```

### Check Database in Container
```bash
docker exec mrp-backend ls -lh /app/data/
docker exec mrp-backend sqlite3 /app/data/mrp.db "SELECT COUNT(*) FROM products;"
```

### Manually Copy Database
```bash
docker compose stop backend
docker cp ~/mrp-mvp/data/mrp.db mrp-backend:/app/data/mrp.db
docker exec mrp-backend chmod 666 /app/data/mrp.db
docker compose start backend
```

### Full Clean Rebuild
```bash
docker compose down -v
docker rmi mrp-mvp-backend mrp-mvp-frontend
docker compose build --no-cache
docker compose up -d
```

---

## Why This Works Now

1. **`database.py` now reads `DATABASE_PATH` environment variable** - Docker sets this to `/app/data/mrp.db`
2. **Added debugging output** - You can see exactly what path is being used and if the file exists
3. **Improved Dockerfile** - Added SQLite tools and better permissions
4. **Using `docker cp`** - Bypasses volume mount issues in LXC containers

Your local Windows path (`C:\Users\jtopham.CACHEOPS\Desktop\L3 Trigger sheets\mrp-mvp\data`) is only used for local development. In Docker, it uses `/app/data/mrp.db` inside the container.

---

## Next Steps After This Works

1. **Backup the database regularly:**
   ```bash
   docker cp mrp-backend:/app/data/mrp.db ~/backups/mrp_$(date +%Y%m%d).db
   ```

2. **Push code to GitHub** (so you have a backup)

3. **Set up automated backups** with a cron job

4. **Consider PostgreSQL** for better production database management
