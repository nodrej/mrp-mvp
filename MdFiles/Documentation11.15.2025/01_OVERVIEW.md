# System Overview

## What is the MRP System?

The Material Requirements Planning (MRP) System is a comprehensive inventory and production planning application designed to help manufacturers manage their entire supply chain from raw materials to finished goods. It replaces traditional spreadsheet-based systems with a modern, automated solution.

---

## 🎯 Key Objectives

1. **Inventory Visibility** - Real-time tracking of all materials and products
2. **Production Planning** - Forecast component needs based on production goals
3. **Shortage Prevention** - Early warning system for material shortages
4. **Purchase Optimization** - Smart reorder points and purchase order management
5. **Data-Driven Decisions** - Analytics and reporting for informed planning

---

## 🌟 Core Features

### 1. Multi-Level Bill of Materials (BOM)
- Define product structures with unlimited nesting
- Finished goods → Sub-assemblies → Components → Raw materials
- Automatic BOM explosion for production planning
- Track "where-used" relationships

### 2. Real-Time Inventory Management
- Track on-hand quantities for all products
- Monitor allocated vs. available inventory
- Complete audit trail of all adjustments
- Support for inventory adjustments with reasons

### 3. Production Planning
- Set weekly shipment goals for finished goods
- Track actual shipments vs. goals
- Dynamic daily goal calculations
- Performance analytics and trends

### 4. Material Requirements Planning (MRP)
- Automatic calculation of component needs
- Multi-level BOM explosion
- Lead time consideration
- Shortage detection with urgency levels
- Daily build analysis showing day-by-day material consumption

### 5. Purchase Order Management
- Create and track purchase orders
- Expected delivery dates
- PO receipt processing with automatic inventory updates
- Pending PO visibility in material analysis
- Undo receipt capability

### 6. Dynamic Reorder Points
- Automatically calculated based on actual demand
- Considers weekly shipment goals
- Adjusts for lead times and safety stock
- Updates as production plans change

### 7. Sales & Shipping Tracking
- Record daily sales/shipments
- Automatic inventory deduction for finished goods
- Automatic component consumption via BOM
- Bulk import capability for multiple products
- Integration with weekly goals

### 8. Analytics & Reporting
- Executive dashboard with KPIs
- Material analysis with projected inventory
- Weekly shipment analytics
- Performance trends and achievements
- Shortage alerts with recommended actions

---

## 🏗️ System Architecture

### Technology Stack

**Frontend:**
- React 18.2 with TypeScript
- Ant Design UI component library
- Recharts for data visualization
- Vite build tool
- Axios for API communication

**Backend:**
- Python 3.10+
- FastAPI web framework
- SQLAlchemy ORM
- Pydantic validation
- Uvicorn ASGI server

**Database:**
- SQLite (embedded, file-based)
- 9 interconnected tables
- Foreign key relationships
- Transaction support

**Deployment:**
- Backend: http://localhost:8000 (API server)
- Frontend: http://localhost:3000 (Web UI)
- Single-database architecture
- No external dependencies

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Web Browser (UI)                      │
│              React + TypeScript + Ant Design            │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────────┐
│                 FastAPI Backend                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ API Layer (main.py - 37+ endpoints)              │  │
│  └──────────────┬──────────────────────────────────┬┘  │
│                 │                                  │    │
│  ┌──────────────▼────────────┐  ┌─────────────────▼┐   │
│  │  Business Logic (mrp.py)  │  │  Data Validation │   │
│  │  - MRP calculations       │  │  (schemas.py)    │   │
│  │  - BOM explosion          │  └──────────────────┘   │
│  │  - Reorder points         │                         │
│  └──────────────┬────────────┘                         │
│                 │                                       │
│  ┌──────────────▼────────────────────────────────────┐ │
│  │         ORM Layer (models.py)                     │ │
│  │         SQLAlchemy - 9 data models                │ │
│  └──────────────┬────────────────────────────────────┘ │
└─────────────────┼────────────────────────────────────┘
                  │ SQL
┌─────────────────▼────────────────────────────────────┐
│            SQLite Database (mrp.db)                   │
│  - products, bom_lines, inventory                     │
│  - sales_history, weekly_shipments                    │
│  - purchase_orders, inventory_adjustments             │
│  - daily_demand, mrp_results                          │
└───────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Example

**Scenario:** User sets weekly shipment goal → System calculates component needs

1. **User Input** (Weekly Goals page)
   - Sets goal: "Ship 2,300 units of L3 Trigger this week"

2. **Backend Processing** (Weekly shipment API)
   - Saves goal to `weekly_shipments` table
   - Calculates daily target: 2,300 ÷ 5 workdays = 460/day

3. **MRP Calculation** (MRP Engine)
   - Retrieves all weekly goals for next 6-8 weeks
   - For each finished good, explodes BOM to find components
   - Example: L3 Trigger needs 2× Housing per unit
   - Component need: 460 units/day × 2 = 920 Housing/day

4. **Material Analysis** (Daily Build Analysis)
   - Gets current inventory: Housing = 5,000 units
   - Calculates consumption: 920 units/day
   - Adds incoming POs (if any)
   - Projects day-by-day: Day 1 = 4,080, Day 2 = 3,160, etc.
   - Detects run-out date when projected < 0

5. **User Notification** (Dashboard)
   - Shows shortage alert: "Housing - Critical"
   - Recommends order quantity: "Order 10,000 units"
   - Shows urgency: "Will run out in 5 days"

6. **Purchase Order** (PO Management)
   - User creates PO for 10,000 Housing
   - Sets expected date: 7 days from now
   - System adds to pending PO list

7. **PO Receipt** (Inventory Update)
   - User receives PO (clicks "Receive")
   - System adds 10,000 to inventory
   - Creates audit trail entry
   - Updates material analysis projections

---

## 🔑 Key Concepts

### Products
Any item tracked in the system. Four types:
- **Finished Goods** - Final products shipped to customers
- **Sub-assemblies** - Intermediate assemblies used in finished goods
- **Components** - Parts that go into assemblies
- **Raw Materials** - Basic materials used in production

### Bill of Materials (BOM)
Defines the "recipe" for building a product. Each BOM line specifies:
- Parent product (what you're building)
- Component product (what you need)
- Quantity per (how many components per parent)

### Inventory
Current stock levels with three values:
- **On-hand** - Physical inventory in warehouse
- **Allocated** - Reserved for specific orders/builds
- **Available** - On-hand minus allocated (what's truly available)

### Lead Time
Days between ordering and receiving a product. Used in MRP calculations to determine when to reorder.

### Reorder Point
Inventory level that triggers a purchase order. Dynamically calculated based on:
- Average weekly usage
- Lead time
- Safety stock buffer

### Safety Stock
Buffer inventory to protect against demand variability or supply delays.

### MRP Results
Cached calculations showing:
- Projected inventory levels day-by-day
- When shortages will occur
- Recommended order quantities

---

## 👥 User Roles

### Production Planner
- Sets weekly shipment goals
- Reviews material analysis
- Creates purchase orders
- Monitors shortage alerts

### Inventory Manager
- Makes inventory adjustments
- Receives purchase orders
- Reviews inventory levels
- Maintains product master data

### Production Engineer
- Defines product BOMs
- Creates new products
- Maintains component relationships
- Sets lead times and reorder points

### Executive/Manager
- Views dashboard KPIs
- Reviews analytics and trends
- Monitors overall performance
- Makes strategic decisions

---

## 💡 Benefits

### Replaces Spreadsheets
- **Before:** Multiple Excel files, manual calculations, version control issues
- **After:** Single source of truth, automatic calculations, real-time updates

### Prevents Stockouts
- Early warning system (days/weeks in advance)
- Considers all levels of BOM
- Accounts for lead times
- Recommended order quantities

### Reduces Excess Inventory
- Dynamic reorder points based on actual demand
- Tracks slow-moving and stagnant items
- Visibility into what's really needed

### Improves Planning Accuracy
- Multi-level BOM explosion
- Day-by-day projections
- Considers pending POs
- Tracks planned vs. actual performance

### Provides Audit Trail
- Every inventory change recorded
- Who, what, when, why documented
- Historical trends preserved
- Compliance-ready reporting

### Enables Data-Driven Decisions
- Performance metrics and KPIs
- Trend analysis
- Achievement tracking
- Forecasting capabilities

---

## 📈 Typical Workflow

### Daily Operations
1. **Morning:** Check Dashboard for shortages and KPIs
2. **Throughout Day:** Record sales/shipments as they occur
3. **Review:** Check weekly goal progress
4. **Action:** Create POs for items showing shortages
5. **Receive:** Process incoming deliveries

### Weekly Planning
1. **Set Goals:** Enter weekly shipment goals for all products
2. **Run Analysis:** Review daily build analysis
3. **Check Materials:** Verify all components are available
4. **Order:** Create POs for items needed in next 2-4 weeks
5. **Adjust:** Update reorder points if demand patterns change

### Monthly Review
1. **Analytics:** Review performance trends
2. **Inventory:** Check for slow-moving/stagnant items
3. **BOMs:** Update BOMs if product designs change
4. **Parameters:** Adjust lead times, safety stock as needed
5. **Report:** Generate executive summary

---

## 🚀 Getting Started

New to the system? Follow this learning path:

1. **[Installation Guide](02_INSTALLATION.md)** - Set up the system
2. **[Quick Start](03_QUICK_START.md)** - Basic operations walkthrough
3. **[Dashboard Guide](04_USER_GUIDE_DASHBOARD.md)** - Understand KPIs and alerts
4. **[Products Guide](05_USER_GUIDE_PRODUCTS.md)** - Learn product and BOM management
5. **[Material Analysis](10_USER_GUIDE_MATERIAL_ANALYSIS.md)** - Master production planning

---

## 📞 Support Resources

- **[Troubleshooting Guide](26_TROUBLESHOOTING.md)** - Common issues and solutions
- **[FAQ](27_FAQ.md)** - Frequently asked questions
- **[Glossary](28_GLOSSARY.md)** - Terms and definitions
- **[API Reference](13_API_REFERENCE.md)** - For integration needs

---

*Next: [Installation Guide →](02_INSTALLATION.md)*
