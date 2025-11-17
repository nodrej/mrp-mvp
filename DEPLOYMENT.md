# MRP System - Docker Deployment Guide

This guide covers deploying the MRP System using Docker containers on Proxmox or any Docker-compatible server.

---

## 🐳 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git
- 2GB RAM minimum, 4GB recommended
- 10GB disk space

---

## 🚀 Quick Start (Proxmox or any Linux server)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/mrp-mvp.git
cd mrp-mvp
```

### 2. Build and Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 3. Access the Application

- **Frontend:** http://YOUR_SERVER_IP
- **Backend API:** http://YOUR_SERVER_IP:8000
- **API Docs:** http://YOUR_SERVER_IP:8000/docs

---

## 📦 What Gets Deployed

### Services

1. **Backend Container** (`mrp-backend`)
   - FastAPI application
   - Python 3.10
   - Port: 8000
   - Auto-restarts on failure

2. **Frontend Container** (`mrp-frontend`)
   - Nginx serving React build
   - Port: 80 (HTTP)
   - Proxies API calls to backend
   - Auto-restarts on failure

### Volumes

- `./data:/app/data` - Database persistence (SQLite)

### Networks

- `mrp-network` - Bridge network for inter-container communication

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory (optional):

```env
# Backend
DATABASE_PATH=/app/data/mrp.db
PYTHONUNBUFFERED=1

# Frontend (if needed for custom backend URL)
VITE_API_URL=http://backend:8000
```

### Port Customization

Edit `docker-compose.yml` to change exposed ports:

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Change 8080 to your desired port

  backend:
    ports:
      - "8001:8000"  # Change 8001 to your desired port
```

---

## 🏗️ Building Images Manually

### Backend Only

```bash
cd backend
docker build -t mrp-backend:latest .
docker run -d -p 8000:8000 -v $(pwd)/../data:/app/data mrp-backend:latest
```

### Frontend Only

```bash
cd frontend
docker build -t mrp-frontend:latest .
docker run -d -p 80:80 mrp-frontend:latest
```

---

## 📊 Proxmox-Specific Setup

### Option 1: LXC Container (Recommended)

1. **Create LXC Container:**
   - Template: Ubuntu 22.04
   - RAM: 4GB
   - Disk: 20GB
   - CPU: 2 cores

2. **Install Docker in LXC:**
   ```bash
   # Update system
   apt update && apt upgrade -y

   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh

   # Install Docker Compose
   apt install docker-compose-plugin -y

   # Verify installation
   docker --version
   docker compose version
   ```

3. **Clone and Deploy:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/mrp-mvp.git
   cd mrp-mvp
   docker compose up -d
   ```

### Option 2: Virtual Machine

1. **Create VM:**
   - OS: Ubuntu Server 22.04
   - RAM: 4GB
   - Disk: 32GB
   - CPU: 2 cores

2. **Install Docker:**
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose -y
   sudo systemctl enable docker
   sudo systemctl start docker
   sudo usermod -aG docker $USER
   ```

3. **Deploy Application:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/mrp-mvp.git
   cd mrp-mvp
   docker compose up -d
   ```

---

## 🔒 Production Recommendations

### 1. Use Reverse Proxy (Traefik or Nginx Proxy Manager)

**Example with Traefik:**

```yaml
# docker-compose.yml additions
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mrp.rule=Host(`mrp.yourdomain.com`)"
      - "traefik.http.routers.mrp.entrypoints=websecure"
      - "traefik.http.routers.mrp.tls.certresolver=letsencrypt"
```

### 2. Enable HTTPS

```bash
# Using Certbot with Nginx
apt install certbot python3-certbot-nginx
certbot --nginx -d mrp.yourdomain.com
```

### 3. Set Up Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/mrp"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker compose exec -T backend cp /app/data/mrp.db /app/data/mrp_backup_$DATE.db
cp data/mrp.db $BACKUP_DIR/mrp_$DATE.db

# Keep only last 30 days of backups
find $BACKUP_DIR -name "mrp_*.db" -mtime +30 -delete

echo "Backup completed: mrp_$DATE.db"
EOF

chmod +x backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup.sh") | crontab -
```

### 4. Configure Firewall

```bash
# UFW (Ubuntu)
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Or specific IP only
ufw allow from YOUR_IP_RANGE to any port 80
```

### 5. Resource Limits

Edit `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  frontend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

---

## 📋 Management Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100
```

### Restart Services

```bash
# All services
docker-compose restart

# Specific service
docker-compose restart backend
docker-compose restart frontend
```

### Stop/Start

```bash
# Stop all
docker-compose stop

# Start all
docker-compose start

# Stop and remove containers
docker-compose down

# Stop, remove containers, and remove volumes
docker-compose down -v
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Access Container Shell

```bash
# Backend
docker-compose exec backend bash

# Frontend
docker-compose exec frontend sh
```

### Database Operations

```bash
# Backup database
docker-compose exec backend cp /app/data/mrp.db /app/data/mrp_backup.db

# Import sample data
docker-compose exec backend python import_l3_data.py

# Run migrations
docker-compose exec backend python migrate_add_mrp_fields.py
```

---

## 🔍 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check if port is already in use
netstat -tulpn | grep :8000

# Remove and recreate
docker-compose down
docker-compose up -d
```

### Database Issues

```bash
# Check database file exists
ls -lh data/mrp.db

# Check permissions
chmod 644 data/mrp.db

# Verify database integrity
docker-compose exec backend sqlite3 /app/data/mrp.db "PRAGMA integrity_check;"
```

### Frontend Can't Connect to Backend

```bash
# Verify network
docker network ls
docker network inspect mrp-mvp_mrp-network

# Check backend health
curl http://localhost:8000/health

# Check nginx config
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a --volumes

# Check container sizes
docker ps --size
```

---

## 📊 Monitoring

### Health Checks

Both containers have built-in health checks:

```bash
# View health status
docker ps

# Detailed health check logs
docker inspect --format='{{.State.Health.Status}}' mrp-backend
docker inspect --format='{{.State.Health.Status}}' mrp-frontend
```

### Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats mrp-backend mrp-frontend
```

---

## 🔄 Migration from Development

### Export Data from Development

```bash
# On development machine
cd "C:\Users\jtopham.CACHEOPS\Desktop\L3 Trigger sheets\mrp-mvp"
cp data/mrp.db data/mrp_export.db
```

### Import to Production

```bash
# On production server
scp user@dev-machine:/path/to/mrp_export.db ./data/mrp.db
docker-compose restart backend
```

---

## 🌐 Accessing from External Network

### Port Forwarding (Router)

Forward these ports to your Proxmox server:
- Port 80 (HTTP) → Proxmox_IP:80
- Port 443 (HTTPS) → Proxmox_IP:443

### Dynamic DNS (Optional)

Use services like:
- DuckDNS
- No-IP
- Cloudflare

---

## 📱 Mobile Access

The application is responsive and works on mobile devices. Simply access via:
- http://YOUR_SERVER_IP (local network)
- https://mrp.yourdomain.com (with domain)

---

## 🔐 Security Checklist

- [ ] Change default ports if exposed to internet
- [ ] Enable HTTPS with valid certificate
- [ ] Set up firewall rules
- [ ] Configure regular backups
- [ ] Use strong passwords for Proxmox
- [ ] Keep Docker and host system updated
- [ ] Limit access to trusted IPs only (optional)
- [ ] Enable Docker security features (AppArmor/SELinux)

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Proxmox Documentation](https://pve.proxmox.com/pve-docs/)
- [MRP System Documentation](MdFiles/Documentation11.15.2025/README.md)

---

## 💬 Support

For issues:
1. Check logs: `docker-compose logs`
2. Review [Troubleshooting Guide](MdFiles/Documentation11.15.2025/26_TROUBLESHOOTING.md)
3. Check GitHub Issues
4. Contact your system administrator

---

*Last updated: November 17, 2025*
