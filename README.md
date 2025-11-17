# MRP System (Material Requirements Planning)

A modern, full-stack Material Requirements Planning system for manufacturing inventory and production management. Built with React, TypeScript, FastAPI, and SQLite.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-green.svg)
![React](https://img.shields.io/badge/react-18.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## 🎯 Overview

The MRP System replaces traditional spreadsheet-based inventory management with a modern, automated solution featuring:

- **Multi-Level Bill of Materials (BOM)** - Unlimited nesting for complex assemblies
- **Real-Time Inventory Tracking** - Complete audit trail of all changes
- **Production Planning** - Weekly goals with performance analytics
- **Material Requirements Planning** - Automated shortage detection
- **Purchase Order Management** - Full lifecycle tracking
- **Dynamic Reorder Points** - Calculated from actual demand patterns

---

## ✨ Key Features

### 📦 Inventory Management
- Real-time stock tracking with on-hand, allocated, and available quantities
- Automatic inventory deduction when sales are recorded
- Complete audit trail with reasons and timestamps
- Multi-level BOM explosion for component consumption

### 📊 Production Planning
- Set weekly shipment goals for finished goods
- Track actual vs. planned performance
- Analytics dashboard with achievement rates and trends
- Dynamic daily goals based on remaining workdays

### 🔍 Material Analysis
- Day-by-day component consumption forecast
- Projected inventory levels considering lead times
- Shortage detection with urgency levels (critical, warning, caution)
- Stagnant inventory identification

### 🛒 Purchase Orders
- Create and track purchase orders
- Automatic inventory updates on receipt
- Pending PO visibility in material projections
- Undo receipt capability for corrections

### 📈 Analytics
- Executive dashboard with KPIs
- Weekly shipment performance tracking
- Best/worst week analysis
- Monthly achievement summaries
- Streak tracking

---

## 🚀 Quick Start

### Option 1: Docker (Recommended for Production)

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/mrp-mvp.git
cd mrp-mvp

# Start with Docker Compose
docker-compose up -d

# Access application
# Frontend: http://localhost
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

**See [DEPLOYMENT.md](DEPLOYMENT.md) for complete Docker deployment guide.**

### Option 2: Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python import_l3_data.py  # Import sample data
python main.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

**See full installation guide:** [MdFiles/Documentation11.15.2025/02_INSTALLATION.md](MdFiles/Documentation11.15.2025/02_INSTALLATION.md)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│     React + TypeScript Frontend     │
│   (Ant Design UI + Recharts)        │
└──────────────┬──────────────────────┘
               │ REST API
┌──────────────▼──────────────────────┐
│       FastAPI Backend (Python)      │
│   - MRP Calculation Engine          │
│   - BOM Explosion                   │
│   - Inventory Management            │
└──────────────┬──────────────────────┘
               │ SQLAlchemy ORM
┌──────────────▼──────────────────────┐
│      SQLite Database (9 tables)     │
│   products, bom_lines, inventory,   │
│   sales, weekly_shipments, pos      │
└─────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
- React 18.2 with TypeScript
- Ant Design 5.11.5 (UI components)
- Recharts 3.4.1 (charts & visualizations)
- Axios 1.6.2 (HTTP client)
- Vite 5.0.5 (build tool)
- Day.js 1.11.10 (date handling)

### Backend
- Python 3.10+
- FastAPI 0.115.0 (web framework)
- SQLAlchemy 2.0.36 (ORM)
- Pydantic 2.10.3 (validation)
- Uvicorn 0.32.0 (ASGI server)

### Database
- SQLite (development/small deployments)
- Easily migrated to PostgreSQL for production

---

## 📚 Documentation

Comprehensive documentation is available in [MdFiles/Documentation11.15.2025/](MdFiles/Documentation11.15.2025/):

### Getting Started
- **[Overview](MdFiles/Documentation11.15.2025/01_OVERVIEW.md)** - System overview and features
- **[Installation](MdFiles/Documentation11.15.2025/02_INSTALLATION.md)** - Detailed setup guide
- **[Deployment](DEPLOYMENT.md)** - Docker and Proxmox deployment

### User Guides
- **[Weekly Goals](MdFiles/Documentation11.15.2025/08_USER_GUIDE_WEEKLY_GOALS.md)** - Production planning
- Dashboard, Products, Inventory guides (in progress)

### Technical Documentation
- **[Database Schema](MdFiles/Documentation11.15.2025/12_DATABASE_SCHEMA.md)** - Complete database reference
- **[API Reference](MdFiles/Documentation11.15.2025/13_API_REFERENCE.md)** - REST API documentation
- **[MRP Logic](MdFiles/Documentation11.15.2025/20_MRP_CALCULATION_LOGIC.md)** - Calculation algorithms

**Complete index:** [MdFiles/Documentation11.15.2025/00_INDEX.md](MdFiles/Documentation11.15.2025/00_INDEX.md)

---

## 🎯 Use Cases

Perfect for:
- Small to medium manufacturing companies
- Production planners and inventory managers
- Companies transitioning from spreadsheet-based systems
- Custom assembly operations
- Multi-level product assemblies
- Just-in-time inventory management

---

## 📸 Screenshots

### Dashboard
Executive summary with KPIs, shortage alerts, and performance metrics.

### Weekly Goals
Track production goals vs. actual shipments with analytics.

### Material Analysis
Day-by-day component consumption forecast with run-out dates.

### Purchase Orders
Complete PO lifecycle management with inventory integration.

---

## 🗂️ Project Structure

```
mrp-mvp/
├── backend/                    # FastAPI backend
│   ├── main.py                # API endpoints (1,757 lines)
│   ├── models.py              # Database models
│   ├── schemas.py             # Pydantic schemas
│   ├── mrp.py                 # MRP calculation engine
│   ├── database.py            # DB configuration
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Backend Docker image
│   └── [import scripts]       # Data import utilities
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── App.tsx            # Main application
│   │   ├── components/        # React components
│   │   ├── services/          # API client
│   │   └── utils/             # Utilities
│   ├── package.json           # Node dependencies
│   ├── vite.config.ts         # Build configuration
│   ├── Dockerfile             # Frontend Docker image
│   └── nginx.conf             # Nginx configuration
│
├── data/                       # Database storage
│   └── mrp.db                 # SQLite database
│
├── MdFiles/                    # Documentation
│   └── Documentation11.15.2025/
│
├── docker-compose.yml          # Docker orchestration
├── DEPLOYMENT.md               # Deployment guide
├── README.md                   # This file
└── .gitignore                  # Git ignore rules
```

---

## 🔧 Configuration

### Backend Configuration

Edit `backend/database.py` for database path:
```python
DB_PATH = os.path.join(BASE_DIR, "..", "data", "mrp.db")
```

### Frontend Configuration

Edit `frontend/vite.config.ts` for API proxy:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

---

## 🧪 Sample Data

Import sample data (L3 Trigger Assembly with 19 components):

```bash
cd backend
python import_l3_data.py        # Products and BOMs
python import_sales_data.py     # Sales history
python import_weekly_goals.py   # Weekly goals
```

---

## 🔄 API Endpoints

**37+ REST endpoints** organized by feature:

- `/api/products` - Product CRUD and BOM management
- `/api/inventory` - Inventory tracking and adjustments
- `/api/sales` - Sales/shipment recording
- `/api/weekly-shipments` - Production goals
- `/api/purchase-orders` - PO management
- `/api/mrp/calculate` - Run MRP calculation
- `/api/demand/daily-build-analysis` - Material analysis
- `/api/dashboard` - Executive summary

**Interactive API docs:** http://localhost:8000/docs

---

## 🚢 Deployment

### Docker Deployment (Recommended)

```bash
docker-compose up -d
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Proxmox LXC container setup
- Production configuration
- HTTPS/SSL setup
- Backup strategies
- Resource limits
- Monitoring

### Traditional Deployment

- **Backend:** Uvicorn, Gunicorn, or systemd service
- **Frontend:** Nginx, Apache, or any static file server
- **Database:** SQLite (included) or PostgreSQL (recommended for production)

---

## 🔐 Security

**Current version is designed for internal/local network use.**

For production deployment:
- [ ] Enable HTTPS/SSL
- [ ] Add authentication (JWT/OAuth2)
- [ ] Configure CORS properly
- [ ] Use PostgreSQL with proper credentials
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Use environment variables for secrets

---

## 📈 Roadmap

### Planned Features
- [ ] User authentication and authorization
- [ ] Multi-tenant support
- [ ] PostgreSQL migration
- [ ] Work order management
- [ ] Production scheduling
- [ ] Advanced reporting
- [ ] Email notifications
- [ ] Mobile app
- [ ] API webhooks
- [ ] Integration with ERP systems

See [MdFiles/Documentation11.15.2025/30_ROADMAP.md](MdFiles/Documentation11.15.2025/30_ROADMAP.md) for details.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- Built with modern best practices and design patterns
- Inspired by real-world manufacturing challenges
- Community feedback and testing

---

## 📞 Support

- **Documentation:** [MdFiles/Documentation11.15.2025/](MdFiles/Documentation11.15.2025/)
- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions

---

## 📊 Stats

- **Backend:** 1,757 lines (main.py)
- **Database:** 9 interconnected tables
- **API Endpoints:** 37+
- **Frontend Components:** 10 major components
- **Documentation:** 7 complete guides + comprehensive reference

---

**Built with ❤️ for manufacturers who need better inventory management**

*Last updated: November 17, 2025*
