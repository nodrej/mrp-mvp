# Installation Guide

This guide will walk you through installing and setting up the MRP System on your local machine or server.

---

## 📋 Prerequisites

### System Requirements

**Operating System:**
- Windows 10/11
- macOS 10.15+
- Linux (Ubuntu 20.04+, Debian 10+)

**Hardware:**
- CPU: 2+ cores recommended
- RAM: 4GB minimum, 8GB recommended
- Disk: 500MB for application, 1GB+ for data growth

### Required Software

**Backend Requirements:**
- Python 3.10 or higher
- pip (Python package manager)

**Frontend Requirements:**
- Node.js 16.x or higher
- npm 8.x or higher (comes with Node.js)

**Database:**
- SQLite (included with Python, no separate installation needed)

---

## 🔧 Installation Steps

### Step 1: Verify Prerequisites

**Check Python version:**
```bash
python --version
# Should show: Python 3.10.x or higher
```

**Check Node.js version:**
```bash
node --version
# Should show: v16.x.x or higher

npm --version
# Should show: 8.x.x or higher
```

📌 **Note:** If you need to install Python or Node.js:
- Python: Download from [python.org](https://www.python.org/downloads/)
- Node.js: Download from [nodejs.org](https://nodejs.org/)

---

### Step 2: Clone or Extract the Application

If you have the application as a ZIP file:
```bash
# Extract to desired location
cd "C:\Users\YourName\Desktop\L3 Trigger sheets"
# (or your preferred directory)
```

Navigate to the application directory:
```bash
cd mrp-mvp
```

---

### Step 3: Install Backend Dependencies

Navigate to the backend directory:
```bash
cd backend
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

**Dependencies installed:**
- fastapi==0.115.0 - Web framework
- uvicorn==0.32.0 - ASGI server
- sqlalchemy==2.0.36 - Database ORM
- pydantic==2.10.3 - Data validation
- pydantic-settings==2.7.0 - Configuration
- python-multipart==0.0.18 - File upload support

📌 **Note:** If you encounter permission errors, try:
```bash
pip install --user -r requirements.txt
```

---

### Step 4: Initialize the Database

**Option A: Import Sample Data (Recommended for first-time setup)**

Import the L3 Trigger product and components:
```bash
python import_l3_data.py
```

This creates:
- 1 finished good (L3 Trigger Assembly)
- 19 components with BOMs
- Sample inventory levels
- Pre-configured lead times and reorder points

**Option B: Start with Empty Database**

Just start the server (Step 5). The database will be created automatically.

**Optional: Import Sales History**
```bash
python import_sales_data.py
```

**Optional: Import Weekly Goals**
```bash
python import_weekly_goals.py
```

---

### Step 5: Start the Backend Server

Start the FastAPI server:
```bash
python main.py
```

You should see:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

✅ **Backend is now running!**

Test it by opening: http://localhost:8000/health

You should see: `{"status": "healthy"}`

---

### Step 6: Install Frontend Dependencies

Open a **new terminal window** (keep the backend running).

Navigate to the frontend directory:
```bash
cd frontend
```

Install Node.js dependencies:
```bash
npm install
```

This will install:
- React and React DOM
- TypeScript
- Ant Design (UI components)
- Recharts (data visualization)
- Axios (HTTP client)
- Vite (build tool)
- Day.js (date utilities)

📌 **Note:** This may take a few minutes depending on your internet speed.

---

### Step 7: Configure Frontend

Edit the Vite configuration if your backend is on a different machine:

Open `frontend/vite.config.ts` and update the proxy target:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',  // Change if backend is elsewhere
      changeOrigin: true,
    },
  },
},
```

---

### Step 8: Start the Frontend Development Server

```bash
npm run dev
```

You should see:
```
  VITE v5.0.5  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.10:3000/
```

✅ **Frontend is now running!**

---

### Step 9: Access the Application

Open your web browser and navigate to:

```
http://localhost:3000
```

You should see the MRP System dashboard!

---

## 🎉 Installation Complete!

You now have:
- ✅ Backend API running on http://localhost:8000
- ✅ Frontend UI running on http://localhost:3000
- ✅ Database initialized at `data/mrp.db`
- ✅ Sample data loaded (if you ran import scripts)

---

## 🔍 Verification Checklist

Test that everything is working:

1. **Dashboard Loads**
   - Navigate to http://localhost:3000
   - Dashboard should display with KPI cards

2. **Products Page**
   - Click "Products" in the sidebar
   - You should see products listed (if sample data was imported)

3. **API Documentation**
   - Navigate to http://localhost:8000/docs
   - Swagger UI should display all API endpoints

4. **Database File**
   - Check that `data/mrp.db` file exists
   - File size should be > 0 bytes

---

## 📁 Directory Structure After Installation

```
mrp-mvp/
├── backend/
│   ├── main.py                    # Backend server (running on :8000)
│   ├── models.py                  # Database models
│   ├── schemas.py                 # API schemas
│   ├── mrp.py                     # MRP calculation engine
│   ├── database.py                # Database configuration
│   ├── requirements.txt           # Python dependencies
│   └── [import scripts]
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main application
│   │   ├── components/           # UI components
│   │   └── services/             # API client
│   ├── package.json              # Node dependencies
│   ├── vite.config.ts           # Build configuration
│   └── node_modules/            # Installed packages (large)
│
├── data/
│   └── mrp.db                    # SQLite database
│
└── MdFiles/
    └── Documentation11.15.2025/  # This documentation
```

---

## 🔄 Starting/Stopping the Application

### Starting

**Terminal 1 (Backend):**
```bash
cd backend
python main.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

### Stopping

Press `Ctrl+C` in each terminal window to stop the servers.

---

## 🌐 Network Access

### Accessing from Other Computers on Your Network

**Backend:**
The backend listens on `0.0.0.0:8000`, which means it's accessible from other machines.

Find your IP address:
- Windows: `ipconfig` → Look for IPv4 Address
- Mac/Linux: `ifconfig` or `ip addr`

**Frontend:**
The frontend shows the network URL when it starts:
```
➜  Network: http://192.168.1.10:3000/
```

Update `frontend/vite.config.ts` to point to your backend IP if accessing from another machine.

---

## 🔐 Security Considerations

⚠️ **This is a development setup suitable for internal/local networks only.**

For production deployment:
- Use HTTPS (SSL/TLS)
- Add authentication/authorization
- Configure CORS properly
- Use a production-grade database (PostgreSQL)
- Set up firewalls
- Use environment variables for configuration

---

## 🐛 Troubleshooting Installation

### Backend won't start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`
- **Solution:** Run `pip install -r requirements.txt` again

**Error:** `Address already in use`
- **Solution:** Port 8000 is taken. Kill the process or change the port in `main.py`

**Error:** `Permission denied writing to data/mrp.db`
- **Solution:** Ensure the `data/` directory has write permissions

### Frontend won't start

**Error:** `npm: command not found`
- **Solution:** Install Node.js from nodejs.org

**Error:** `EACCES: permission denied`
- **Solution:** On Mac/Linux, don't use sudo. Fix npm permissions:
  ```bash
  npm config set prefix '~/.npm-global'
  ```

**Error:** Port 3000 already in use
- **Solution:** Change the port in `vite.config.ts` or kill the process using port 3000

### Cannot connect to backend from frontend

**Error:** API calls fail with network errors
- **Solution:** Check that backend is running on port 8000
- **Solution:** Verify proxy configuration in `vite.config.ts`
- **Solution:** Check firewall settings

### Database issues

**Error:** `database is locked`
- **Solution:** Close any other applications accessing the database
- **Solution:** Restart both servers

**Error:** `no such table: products`
- **Solution:** Database not initialized. Run `python import_l3_data.py`

---

## ⚙️ Advanced Configuration

### Change Backend Port

Edit `backend/main.py`, line at the bottom:
```python
uvicorn.run(app, host="0.0.0.0", port=8000)  # Change 8000 to desired port
```

### Change Frontend Port

Edit `frontend/vite.config.ts`:
```typescript
server: {
  port: 3000,  // Change to desired port
  ...
}
```

### Database Location

Edit `backend/database.py`:
```python
DB_PATH = os.path.join(BASE_DIR, "..", "data", "mrp.db")
# Change to desired path
```

### CORS Configuration

Edit `backend/main.py` to restrict allowed origins:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📦 Building for Production

### Build Frontend

```bash
cd frontend
npm run build
```

This creates optimized files in `frontend/dist/`.

Serve with a web server like Nginx or Apache.

### Backend Production

For production, use a process manager like:
- **Gunicorn** (Linux/Mac)
- **PM2** (Cross-platform)
- **systemd** (Linux service)

Example with Gunicorn:
```bash
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

---

## 📚 Next Steps

Now that installation is complete:

1. **[Quick Start Guide →](03_QUICK_START.md)** - Learn basic operations
2. **[User Guide: Dashboard →](04_USER_GUIDE_DASHBOARD.md)** - Explore the dashboard
3. **[User Guide: Products →](05_USER_GUIDE_PRODUCTS.md)** - Set up your products

---

## 💾 Backup Recommendations

After installation, set up regular backups:

1. **Database backup:**
   ```bash
   cp data/mrp.db data/mrp_backup_$(date +%Y%m%d).db
   ```

2. **Full application backup:**
   - Copy the entire `mrp-mvp/` directory to a safe location
   - See [Backup & Recovery Guide](25_BACKUP_RECOVERY.md) for details

---

*Need help? Check the [Troubleshooting Guide](26_TROUBLESHOOTING.md) or [FAQ](27_FAQ.md)*
