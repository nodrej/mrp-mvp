# Database Schema Reference

This document provides complete reference for the MRP System database structure, including all tables, relationships, and constraints.

---

## 📊 Database Overview

**Database Type:** SQLite
**Location:** `data/mrp.db`
**ORM:** SQLAlchemy 2.0.36
**Tables:** 9

---

## 🗄️ Table Definitions

### 1. products

**Purpose:** Master catalog of all items tracked in the system

**File:** `backend/models.py` (Product class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique product identifier |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL, INDEXED | Product code (e.g., "L3-TRIG", "COMP-001") |
| `name` | VARCHAR(200) | NOT NULL | Product name/description |
| `type` | VARCHAR(20) | NOT NULL | Product type: 'finished_good', 'sub_assembly', 'component', 'raw_material' |
| `uom` | VARCHAR(10) | NOT NULL | Unit of measure (e.g., "each", "lbs", "ft") |
| `reorder_point` | NUMERIC(15,2) | DEFAULT 0 | Inventory level triggering reorder |
| `reorder_qty` | NUMERIC(15,2) | DEFAULT 0 | Quantity to order when reordering |
| `lead_time_days` | INTEGER | DEFAULT 0 | Days from order to receipt |
| `safety_stock` | NUMERIC(15,2) | DEFAULT 0 | Buffer stock quantity |
| `order_multiple` | NUMERIC(15,2) | DEFAULT 1 | Must order in multiples of this |
| `minimum_order_qty` | NUMERIC(15,2) | DEFAULT 0 | Minimum order quantity |
| `critical_days` | INTEGER | DEFAULT 7 | Days threshold for critical urgency |
| `warning_days` | INTEGER | DEFAULT 14 | Days threshold for warning urgency |
| `caution_days` | INTEGER | DEFAULT 30 | Days threshold for caution urgency |
| `category` | VARCHAR(50) | NULL | Product category/family |
| `supplier` | VARCHAR(100) | NULL | Supplier name |
| `tags` | TEXT | NULL | JSON array of tags |
| `is_active` | BOOLEAN | DEFAULT TRUE | Active flag for soft delete |
| `created_at` | DATETIME | SERVER DEFAULT NOW | Record creation timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE INDEX on `code`

**Relationships:**
- One-to-Many: `bom_lines` (as parent)
- One-to-Many: `bom_lines` (as component)
- One-to-One: `inventory`
- One-to-Many: `daily_demand`
- One-to-Many: `mrp_results`
- One-to-Many: `sales_history`
- One-to-Many: `weekly_shipments`
- One-to-Many: `purchase_orders`

**Example Data:**
```sql
INSERT INTO products (code, name, type, uom, reorder_point, lead_time_days)
VALUES ('L3-TRIG', 'L3 Trigger Assembly', 'finished_good', 'each', 500, 0);
```

---

### 2. bom_lines

**Purpose:** Defines component requirements for each product (Bill of Materials)

**File:** `backend/models.py` (BOMLine class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique BOM line identifier |
| `parent_product_id` | INTEGER | FOREIGN KEY → products.id, NOT NULL | Product being built |
| `component_product_id` | INTEGER | FOREIGN KEY → products.id, NOT NULL | Component needed |
| `quantity_per` | NUMERIC(15,4) | NOT NULL | Quantity of component per parent unit |

**Constraints:**
- UNIQUE (`parent_product_id`, `component_product_id`) - Prevents duplicate BOM lines
- FOREIGN KEY `parent_product_id` → `products.id`
- FOREIGN KEY `component_product_id` → `products.id`

**Relationships:**
- Many-to-One: `parent_product` (Product)
- Many-to-One: `component_product` (Product)

**Example Data:**
```sql
-- L3 Trigger requires 2 Housing units
INSERT INTO bom_lines (parent_product_id, component_product_id, quantity_per)
VALUES (1, 5, 2.0000);
```

**Multi-Level BOM Support:**
```
Finished Good (Parent)
  ├─ Sub-Assembly (Component of FG, Parent of parts)
  │   ├─ Component A (Component of Sub-Assembly)
  │   └─ Component B
  └─ Component C (Component of FG)
```

---

### 3. inventory

**Purpose:** Current stock levels for all products

**File:** `backend/models.py` (Inventory class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique inventory record identifier |
| `product_id` | INTEGER | FOREIGN KEY → products.id, UNIQUE, NOT NULL | Product being tracked |
| `on_hand` | NUMERIC(15,2) | DEFAULT 0 | Physical quantity in warehouse |
| `allocated` | NUMERIC(15,2) | DEFAULT 0 | Quantity reserved/allocated |
| `last_updated` | DATETIME | SERVER DEFAULT NOW, ON UPDATE NOW | Last modification timestamp |

**Constraints:**
- UNIQUE on `product_id` - One inventory record per product
- FOREIGN KEY `product_id` → `products.id`

**Relationships:**
- One-to-One: `product` (Product)

**Calculated Properties:**
```python
available = on_hand - allocated
```

**Example Data:**
```sql
INSERT INTO inventory (product_id, on_hand, allocated)
VALUES (5, 5000, 100);  -- 5000 on hand, 100 allocated, 4900 available
```

---

### 4. daily_demand

**Purpose:** Daily demand forecasts for products

**File:** `backend/models.py` (DailyDemand class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique demand record identifier |
| `product_id` | INTEGER | FOREIGN KEY → products.id, NOT NULL | Product demand is for |
| `demand_date` | DATE | NOT NULL | Date of demand |
| `quantity` | NUMERIC(15,2) | NOT NULL | Quantity demanded |

**Constraints:**
- UNIQUE (`product_id`, `demand_date`) - One demand per product per day
- FOREIGN KEY `product_id` → `products.id`

**Relationships:**
- Many-to-One: `product` (Product)

**Example Data:**
```sql
INSERT INTO daily_demand (product_id, demand_date, quantity)
VALUES (1, '2025-11-18', 460);
```

**Usage Note:** This table is populated from weekly shipment goals during MRP calculation.

---

### 5. inventory_adjustments

**Purpose:** Audit trail of all inventory changes

**File:** `backend/models.py` (InventoryAdjustment class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique adjustment identifier |
| `product_id` | INTEGER | FOREIGN KEY → products.id, NOT NULL | Product adjusted |
| `adjustment_date` | DATETIME | SERVER DEFAULT NOW | Timestamp of adjustment |
| `quantity_change` | NUMERIC(15,2) | NOT NULL | Quantity added (+) or removed (-) |
| `reason` | VARCHAR(200) | NULL | Reason code for adjustment |
| `notes` | TEXT | NULL | Additional details |

**Constraints:**
- FOREIGN KEY `product_id` → `products.id`

**Common Reason Codes:**
- "PO Receipt: PO-12345"
- "Production Output"
- "Production Consumption - Used in [Product]"
- "Manual Adjustment"
- "Cycle Count Adjustment"
- "Damaged Goods"
- "Return to Vendor"

**Example Data:**
```sql
INSERT INTO inventory_adjustments
  (product_id, quantity_change, reason, notes)
VALUES
  (5, 10000, 'PO Receipt: PO-2025-001', 'Previous: 5000, New: 15000');
```

---

### 6. mrp_results

**Purpose:** Cached MRP calculation results for performance

**File:** `backend/models.py` (MRPResult class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique result identifier |
| `product_id` | INTEGER | FOREIGN KEY → products.id, NOT NULL | Product calculated |
| `result_date` | DATE | NOT NULL | Date of projection |
| `projected_onhand` | NUMERIC(15,2) | NULL | Projected inventory for this date |
| `needs_ordering` | BOOLEAN | DEFAULT FALSE | True if shortage detected |
| `shortage_date` | DATE | NULL | Date when shortage will occur |
| `calculated_at` | DATETIME | SERVER DEFAULT NOW | Timestamp of calculation |

**Constraints:**
- UNIQUE (`product_id`, `result_date`) - One result per product per date
- FOREIGN KEY `product_id` → `products.id`

**Relationships:**
- Many-to-One: `product` (Product)

**Example Data:**
```sql
INSERT INTO mrp_results
  (product_id, result_date, projected_onhand, needs_ordering, shortage_date)
VALUES
  (5, '2025-11-25', -250, TRUE, '2025-11-25');
```

---

### 7. sales_history

**Purpose:** Daily sales/shipment transactions

**File:** `backend/models.py` (SalesHistory class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique sales record identifier |
| `product_id` | INTEGER | FOREIGN KEY → products.id, NOT NULL | Product sold |
| `sale_date` | DATE | NOT NULL | Date of sale/shipment |
| `quantity_sold` | NUMERIC(15,2) | NOT NULL | Quantity sold |
| `notes` | TEXT | NULL | Additional information |
| `created_at` | DATETIME | SERVER DEFAULT NOW | Record creation timestamp |

**Constraints:**
- UNIQUE (`product_id`, `sale_date`) - One sales record per product per day
- FOREIGN KEY `product_id` → `products.id`

**Relationships:**
- Many-to-One: `product` (Product)

**Example Data:**
```sql
INSERT INTO sales_history (product_id, sale_date, quantity_sold)
VALUES (1, '2025-11-15', 450);
```

**Side Effects:**
When a sale is recorded:
1. Inventory for finished good is reduced
2. Inventory for all components (via BOM) is reduced
3. Inventory adjustments are created for audit trail
4. Weekly shipment "shipped" totals are updated

---

### 8. weekly_shipments

**Purpose:** Weekly shipment goals and actual tracking

**File:** `backend/models.py` (WeeklyShipment class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique weekly record identifier |
| `product_id` | INTEGER | FOREIGN KEY → products.id, NOT NULL | Product |
| `week_start_date` | DATE | NOT NULL | Monday of the week (ISO week) |
| `goal` | NUMERIC(15,2) | DEFAULT 0 | Target shipment quantity for week |
| `shipped` | NUMERIC(15,2) | DEFAULT 0 | Actual quantity shipped |
| `notes` | TEXT | NULL | Additional information |
| `created_at` | DATETIME | SERVER DEFAULT NOW | Record creation timestamp |
| `updated_at` | DATETIME | ON UPDATE NOW | Last modification timestamp |

**Constraints:**
- UNIQUE (`product_id`, `week_start_date`) - One record per product per week
- FOREIGN KEY `product_id` → `products.id`

**Relationships:**
- Many-to-One: `product` (Product)

**Example Data:**
```sql
INSERT INTO weekly_shipments (product_id, week_start_date, goal, shipped)
VALUES (1, '2025-11-17', 2300, 1200);
```

**Calculation Note:**
- `shipped` is calculated from `sales_history` aggregation
- `goal` is manually set by user
- Week dates must be Monday (ISO 8601 standard)

---

### 9. purchase_orders

**Purpose:** Purchase order tracking for incoming inventory

**File:** `backend/models.py` (PurchaseOrder class)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Unique PO identifier |
| `po_number` | VARCHAR(50) | UNIQUE, NOT NULL, INDEXED | PO number (e.g., "PO-2025-001") |
| `product_id` | INTEGER | FOREIGN KEY → products.id, NOT NULL | Product being ordered |
| `order_date` | DATE | NOT NULL | Date PO was created |
| `expected_date` | DATE | NOT NULL | Expected delivery date |
| `quantity` | NUMERIC(15,2) | NOT NULL | Quantity ordered |
| `status` | VARCHAR(20) | DEFAULT 'pending' | Status: 'pending', 'received', 'cancelled' |
| `received_date` | DATE | NULL | Actual receipt date |
| `received_quantity` | NUMERIC(15,2) | NULL | Actual quantity received |
| `supplier` | VARCHAR(200) | NULL | Supplier name |
| `notes` | TEXT | NULL | Additional information |
| `created_at` | DATETIME | SERVER DEFAULT NOW | Record creation timestamp |
| `updated_at` | DATETIME | ON UPDATE NOW | Last modification timestamp |

**Constraints:**
- UNIQUE on `po_number`
- FOREIGN KEY `product_id` → `products.id`

**Relationships:**
- Many-to-One: `product` (Product)

**Example Data:**
```sql
INSERT INTO purchase_orders
  (po_number, product_id, order_date, expected_date, quantity, status, supplier)
VALUES
  ('PO-2025-001', 5, '2025-11-15', '2025-11-22', 10000, 'pending', 'Acme Manufacturing');
```

**Status Workflow:**
```
pending → received (or cancelled)
```

**Side Effects When Receiving:**
1. Status changes to 'received'
2. `received_date` and `received_quantity` are set
3. Inventory `on_hand` is increased
4. Inventory adjustment record is created

---

## 🔗 Relationship Diagram

```
products (central hub)
  │
  ├──< bom_lines (parent_product_id)
  │     └──> products (component_product_id)
  │
  ├──< inventory (1:1)
  │
  ├──< daily_demand (1:n)
  │
  ├──< mrp_results (1:n)
  │
  ├──< sales_history (1:n)
  │
  ├──< weekly_shipments (1:n)
  │
  └──< purchase_orders (1:n)

inventory_adjustments (audit)
  └──> products (many:1)
```

---

## 📐 Data Types

### Numeric Precision

**NUMERIC(15,2):** Used for quantities and monetary values
- 15 total digits
- 2 decimal places
- Max value: 9,999,999,999,999.99
- Prevents floating-point rounding errors

**NUMERIC(15,4):** Used for BOM quantity_per
- Allows more precise ratios (e.g., 0.3333 for 1/3 unit)

### Date/Time Types

**DATE:** YYYY-MM-DD format
- Used for: sale_date, demand_date, week_start_date, order_date, expected_date

**DATETIME:** YYYY-MM-DD HH:MM:SS format
- Used for: created_at, updated_at, adjustment_date
- Includes timezone support

---

## 🔐 Constraints and Validations

### Unique Constraints

Prevent duplicate data:
- `products.code` - Each product code unique
- `purchase_orders.po_number` - Each PO number unique
- `(product_id, demand_date)` in daily_demand
- `(product_id, sale_date)` in sales_history
- `(product_id, week_start_date)` in weekly_shipments
- `(product_id, result_date)` in mrp_results
- `(parent_product_id, component_product_id)` in bom_lines

### Foreign Key Relationships

All cascade behavior is default (RESTRICT on delete):
- Cannot delete a product if it has inventory
- Cannot delete a product if used in a BOM
- Cannot delete a product with sales history

To delete a product, must first:
1. Remove from all BOMs
2. Delete related records (sales, POs, etc.)
3. Or use soft delete: `UPDATE products SET is_active = FALSE`

---

## 🔍 Common Queries

### Get Product with Inventory
```sql
SELECT p.*, i.on_hand, i.allocated, (i.on_hand - i.allocated) as available
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
WHERE p.code = 'L3-TRIG';
```

### Get Complete BOM for Product
```sql
SELECT
  cp.code as component_code,
  cp.name as component_name,
  bl.quantity_per,
  cp.uom
FROM bom_lines bl
JOIN products pp ON bl.parent_product_id = pp.id
JOIN products cp ON bl.component_product_id = cp.id
WHERE pp.code = 'L3-TRIG'
ORDER BY cp.code;
```

### Get Weekly Shipment Summary
```sql
SELECT
  p.code,
  p.name,
  ws.week_start_date,
  ws.goal,
  ws.shipped,
  (ws.shipped - ws.goal) as variance,
  CASE
    WHEN ws.goal > 0 THEN (ws.shipped * 100.0 / ws.goal)
    ELSE NULL
  END as achievement_pct
FROM weekly_shipments ws
JOIN products p ON ws.product_id = p.id
WHERE ws.week_start_date >= date('now', '-12 weeks')
ORDER BY ws.week_start_date DESC;
```

### Get Inventory Adjustment History
```sql
SELECT
  p.code,
  p.name,
  ia.adjustment_date,
  ia.quantity_change,
  ia.reason,
  ia.notes
FROM inventory_adjustments ia
JOIN products p ON ia.product_id = p.id
WHERE p.code = 'COMP-001'
ORDER BY ia.adjustment_date DESC
LIMIT 50;
```

### Get Pending Purchase Orders
```sql
SELECT
  po.po_number,
  p.code,
  p.name,
  po.quantity,
  po.expected_date,
  po.supplier
FROM purchase_orders po
JOIN products p ON po.product_id = p.id
WHERE po.status = 'pending'
ORDER BY po.expected_date ASC;
```

---

## 📊 Data Integrity

### Automatic Calculations

**Inventory Available:**
Calculated on-the-fly, not stored:
```python
available = inventory.on_hand - inventory.allocated
```

**Weekly Shipped Total:**
Aggregated from sales_history:
```sql
SELECT SUM(quantity_sold)
FROM sales_history
WHERE product_id = ?
  AND sale_date >= ?  -- Monday
  AND sale_date <= ?  -- Sunday
```

### Cascading Updates

When a sale is recorded:
1. sales_history record created
2. inventory.on_hand reduced (finished good)
3. BOM exploded to find components
4. inventory.on_hand reduced (all components)
5. inventory_adjustments created (FG + components)
6. weekly_shipments.shipped recalculated

When a PO is received:
1. purchase_orders.status = 'received'
2. purchase_orders.received_date = today
3. inventory.on_hand increased
4. inventory_adjustments created

---

## 🛠️ Maintenance

### Database Backup

```bash
# Simple backup
cp data/mrp.db data/mrp_backup_$(date +%Y%m%d).db

# With SQLite command
sqlite3 data/mrp.db ".backup data/mrp_backup.db"
```

### Database Restore

```bash
# Restore from backup
cp data/mrp_backup_YYYYMMDD.db data/mrp.db

# Restart application
```

### Vacuum (Optimize)

```sql
-- Reclaim disk space and optimize
VACUUM;

-- Analyze for query optimization
ANALYZE;
```

### Integrity Check

```sql
PRAGMA integrity_check;
-- Should return: ok
```

---

## 🚀 Performance Considerations

### Indexes

Current indexes:
- `products.id` (PRIMARY KEY)
- `products.code` (UNIQUE)
- `purchase_orders.po_number` (UNIQUE)
- All foreign key columns (implicit)

**Recommended Additional Indexes for Large Datasets:**
```sql
CREATE INDEX idx_sales_history_date ON sales_history(sale_date);
CREATE INDEX idx_weekly_shipments_week ON weekly_shipments(week_start_date);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_expected ON purchase_orders(expected_date);
CREATE INDEX idx_inventory_adjustments_date ON inventory_adjustments(adjustment_date);
```

### Query Optimization

- Use EXPLAIN QUERY PLAN to analyze slow queries
- Avoid SELECT * in application code
- Use prepared statements (handled by SQLAlchemy)
- Limit result sets with pagination

---

## 📚 Related Documentation

- **[Architecture Guide](11_ARCHITECTURE.md)** - System design and data flow
- **[API Reference](13_API_REFERENCE.md)** - Endpoint specifications
- **[MRP Calculation Logic](20_MRP_CALCULATION_LOGIC.md)** - How calculations use this data
- **[Developer Setup](16_DEVELOPER_SETUP.md)** - Database initialization for development

---

*Database schema version: 1.0 | Last updated: November 15, 2025*
