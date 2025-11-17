# MRP Calculation Logic

Detailed explanation of the Material Requirements Planning (MRP) calculation engine and algorithms.

---

## 🎯 Overview

The MRP engine is the core of the system, calculating component requirements based on production goals and detecting potential shortages.

**File:** `backend/mrp.py`

**Main Class:** `MRPEngine`

---

## 🔄 MRP Calculation Flow

```
Weekly Shipment Goals
    ↓
Convert to Daily Demand
    ↓
Multi-Level BOM Explosion
    ↓
Calculate Component Requirements
    ↓
Project Inventory Day-by-Day
    ↓
Detect Shortages & Run-out Dates
    ↓
Generate Recommendations
```

---

## 📊 Key Components

### 1. Daily Demand Calculation

**Input:** Weekly shipment goals (Monday-Sunday)

**Process:**
1. For each product with weekly goals
2. Divide weekly goal by 5 workdays (Mon-Fri)
3. Create daily demand records for each workday

**Formula:**
```
Daily Demand = Weekly Goal ÷ 5 workdays
```

**Example:**
```
Weekly Goal: 2,300 units
Daily Demand: 2,300 ÷ 5 = 460 units/day
Schedule: Mon=460, Tue=460, Wed=460, Thu=460, Fri=460, Sat=0, Sun=0
```

**Code Location:** `backend/main.py` - Daily Build Analysis endpoint

---

### 2. Bill of Materials (BOM) Explosion

**Purpose:** Recursively calculate all component requirements for a finished good

**Algorithm:** Depth-First Search (DFS)

#### Single-Level Explosion

**Input:**
- Parent product
- Parent quantity needed

**Process:**
1. Get all BOM lines for parent
2. For each component:
   - Required Qty = Parent Qty × Quantity Per

**Example:**
```
Product: L3 Trigger (1 unit needed)
BOM:
  - Housing: 2 per unit → Need 2
  - Spring: 1 per unit → Need 1
  - Screw: 4 per unit → Need 4
```

#### Multi-Level Explosion

**Handles nested assemblies:**

```
Finished Good (100 units)
  ├─ Sub-Assembly A (2 per FG) → Need 200
  │   ├─ Component X (3 per SA) → Need 600
  │   └─ Component Y (1 per SA) → Need 200
  └─ Component Z (5 per FG) → Need 500
```

**Code:** `mrp.py` - `explode_bom_recursive()`

```python
def explode_bom_recursive(self, product_id, demand_qty, level=0, visited=None):
    """
    Recursively explodes BOM to calculate all component needs

    Args:
        product_id: Product to explode
        demand_qty: Quantity needed of this product
        level: Current recursion depth (max 10 to prevent infinite loops)
        visited: Set of visited products (circular reference prevention)

    Returns:
        Dict mapping component_id → total_quantity_needed
    """
    if level > 10:
        return {}  # Prevent infinite recursion

    if visited is None:
        visited = set()

    if product_id in visited:
        return {}  # Circular reference detected

    visited.add(product_id)
    component_needs = {}

    # Get BOM lines for this product
    bom_lines = db.query(BOMLine).filter(
        BOMLine.parent_product_id == product_id
    ).all()

    for bom_line in bom_lines:
        component_id = bom_line.component_product_id
        qty_per = bom_line.quantity_per
        component_qty = demand_qty * qty_per

        # Add to component needs
        if component_id in component_needs:
            component_needs[component_id] += component_qty
        else:
            component_needs[component_id] = component_qty

        # Recursive call for sub-assemblies
        sub_components = self.explode_bom_recursive(
            component_id,
            component_qty,
            level + 1,
            visited.copy()
        )

        # Merge sub-component needs
        for sub_comp_id, sub_qty in sub_components.items():
            if sub_comp_id in component_needs:
                component_needs[sub_comp_id] += sub_qty
            else:
                component_needs[sub_comp_id] = sub_qty

    return component_needs
```

**Protection Against:**
- Circular references (A needs B, B needs A)
- Infinite loops (max depth = 10 levels)
- Memory issues (visited set)

---

### 3. Component Consumption Calculation

**For each day in the projection period:**

1. **Get Daily Production Schedule**
   ```python
   for finished_good in all_finished_goods:
       daily_production = weekly_goal / 5  # workdays
   ```

2. **Calculate Component Consumption**
   ```python
   for component in all_components:
       daily_consumption = 0
       for finished_good in all_finished_goods:
           if component_used_in(finished_good):
               qty_per = get_bom_quantity(finished_good, component)
               consumption = daily_production * qty_per
               daily_consumption += consumption
   ```

**Example:**

```
Day: Monday, Nov 18

Production Schedule:
  - L3 Trigger: 460 units
  - L4 Straight: 200 units

Component: Housing
  - Used in L3 Trigger: 2 per unit → 460 × 2 = 920
  - Used in L4 Straight: 2 per unit → 200 × 2 = 400
  - Total Housing consumed: 920 + 400 = 1,320 units

Component: Trigger Spring
  - Used in L3 Trigger: 1 per unit → 460 × 1 = 460
  - Not used in L4 Straight
  - Total Trigger Spring consumed: 460 units
```

---

### 4. Inventory Projection

**Day-by-Day Projection:**

```python
for day in range(days_to_project):
    for component in all_components:
        # Start with previous day's inventory
        projected = previous_day_inventory

        # Subtract consumption for this day
        consumption = calculate_daily_consumption(component, day)
        projected -= consumption

        # Add incoming POs expected on this day
        incoming = get_pos_for_date(component, day)
        projected += incoming

        # Store projection
        projections[component][day] = projected

        # Detect shortage
        if projected < 0 and not shortage_detected:
            shortage_date = day
            shortage_detected = True
```

**Example Projection:**

```
Component: Housing
Current Stock: 5,000 units

Date       | Consumption | Incoming PO | Projected | Status
-----------|-------------|-------------|-----------|--------
Nov 18 Mon | 1,320       | 0           | 3,680     | OK
Nov 19 Tue | 1,320       | 0           | 2,360     | OK
Nov 20 Wed | 1,320       | 10,000      | 11,040    | OK
Nov 21 Thu | 1,320       | 0           | 9,720     | OK
Nov 22 Fri | 1,320       | 0           | 8,400     | OK
Nov 25 Mon | 1,320       | 0           | 7,080     | OK
Nov 26 Tue | 1,320       | 0           | 5,760     | OK
Nov 27 Wed | 1,320       | 0           | 4,440     | OK
Nov 28 Thu | 1,320       | 0           | 3,120     | OK
Nov 29 Fri | 1,320       | 0           | 1,800     | Low
Dec 02 Mon | 1,320       | 0           | 480       | Critical
Dec 03 Tue | 1,320       | 0           | -840      | SHORTAGE!
```

---

### 5. Shortage Detection

**Conditions for Shortage:**

```python
if projected_inventory < 0:
    shortage_detected = True
    shortage_date = current_date
    days_until_shortage = (shortage_date - today).days
```

**Urgency Levels:**

| Days Until Shortage | Urgency Level | Color | Action |
|---------------------|---------------|-------|--------|
| 0-7 days | Critical | Red | Order immediately |
| 8-14 days | Warning | Orange | Order this week |
| 15-30 days | Caution | Yellow | Plan order |
| 31+ days | Normal | Blue | Monitor |

**Code:**
```python
def calculate_urgency(days_until_shortage, product):
    if days_until_shortage <= product.critical_days:  # default 7
        return "critical"
    elif days_until_shortage <= product.warning_days:  # default 14
        return "warning"
    elif days_until_shortage <= product.caution_days:  # default 30
        return "caution"
    else:
        return "normal"
```

---

### 6. Reorder Quantity Calculation

**Dynamic Reorder Point Formula:**

```
Reorder Point = (Average Weekly Usage × Lead Time in Weeks) + Safety Stock
```

**Calculation Steps:**

1. **Get Usage Data (Last 6 Weeks)**
   ```python
   weekly_shipments = get_last_n_weeks(product, 6)
   ```

2. **Calculate Average Weekly Usage**
   ```python
   total_usage = sum(week.goal for week in weekly_shipments)
   average_weekly = total_usage / len(weekly_shipments)
   ```

3. **Convert Lead Time to Weeks**
   ```python
   lead_time_weeks = product.lead_time_days / 7
   ```

4. **Calculate Base Reorder Point**
   ```python
   base_reorder = average_weekly * lead_time_weeks
   ```

5. **Add Safety Stock**
   ```python
   reorder_point = base_reorder + product.safety_stock
   ```

**Example:**

```
Product: Housing
Average Weekly Usage: 6,600 units (from last 6 weeks)
Lead Time: 14 days = 2 weeks
Safety Stock: 500 units

Calculation:
  Base = 6,600 × 2 = 13,200
  Reorder Point = 13,200 + 500 = 13,700 units
```

---

### 7. Recommended Order Quantity

**Formula:**

```
Order Qty = MAX(
  reorder_qty,
  ROUND_UP(shortage_amount, order_multiple),
  minimum_order_qty
)
```

**Lot Sizing Function:**

```python
def round_up_to_lot_size(qty, lot_size, minimum):
    """
    Rounds quantity up to meet order constraints

    Args:
        qty: Quantity needed
        lot_size: Must order in multiples of this (e.g., 50)
        minimum: Minimum order quantity (e.g., 500)

    Returns:
        Adjusted quantity that meets all constraints
    """
    # Ensure meets minimum
    if qty < minimum:
        qty = minimum

    # Round up to nearest multiple
    if lot_size > 0:
        remainder = qty % lot_size
        if remainder != 0:
            qty = qty + (lot_size - remainder)

    return qty
```

**Example:**

```
Shortage: 2,500 units
Order Multiple: 100 units
Minimum Order: 1,000 units

Calculation:
  2,500 needs rounding to multiple of 100
  Already a multiple of 100
  Exceeds minimum (1,000)
  Recommended Order: 2,500 units

Shortage: 750 units
Order Multiple: 100 units
Minimum Order: 1,000 units

Calculation:
  750 rounds up to 800 (next multiple of 100)
  But 800 < minimum of 1,000
  Recommended Order: 1,000 units
```

---

## 🔢 Example: Complete MRP Calculation

**Scenario:**

- Finished Good: L3 Trigger
- Weekly Goal: 2,300 units
- Component: Housing (2 per L3 Trigger)
- Current Stock: 5,000 units
- Pending POs: 10,000 units on Nov 20
- Lead Time: 14 days
- Safety Stock: 500 units
- Order Multiple: 100 units
- Minimum Order: 1,000 units

**Step 1: Daily Demand**
```
Daily Production = 2,300 ÷ 5 = 460 units/day
```

**Step 2: BOM Explosion**
```
Housing per L3 = 2 units
Daily Housing Need = 460 × 2 = 920 units/day
```

**Step 3: Inventory Projection**
```
Day 1 (Nov 18): 5,000 - 920 = 4,080
Day 2 (Nov 19): 4,080 - 920 = 3,160
Day 3 (Nov 20): 3,160 - 920 + 10,000 = 12,240  [PO arrives]
Day 4 (Nov 21): 12,240 - 920 = 11,320
...
Day 14 (Dec 05): 1,200 - 920 = 280
Day 15 (Dec 06): 280 - 920 = -640  [SHORTAGE!]
```

**Step 4: Shortage Detection**
```
Shortage Date: Dec 06
Days Until: 15 days
Urgency: Caution (15-30 days)
Shortage Amount: 640 units (day 15 deficit)
```

**Step 5: Calculate Reorder Point**
```
Avg Weekly Usage: 4,600 (920 × 5)
Lead Time: 14 days = 2 weeks
Reorder Point = 4,600 × 2 + 500 = 9,700 units
```

**Step 6: Recommended Order**
```
Shortage: 640 units
Round to multiple of 100: 700 units
But minimum is 1,000
Recommended Order: 1,000 units

Order before: Dec 06 - 14 days = Nov 22
```

**Result:**
```json
{
  "product": "Housing",
  "current_inventory": 5000,
  "shortage_date": "2025-12-06",
  "days_until_shortage": 15,
  "urgency": "caution",
  "recommended_order_qty": 1000,
  "order_by_date": "2025-11-22",
  "reorder_point": 9700
}
```

---

## ⚙️ Configuration Parameters

### Per-Product Settings

| Parameter | Purpose | Default | Example |
|-----------|---------|---------|---------|
| `lead_time_days` | Days from order to receipt | 0 | 14 |
| `safety_stock` | Buffer inventory | 0 | 500 |
| `order_multiple` | Order quantity rounding | 1 | 100 |
| `minimum_order_qty` | Minimum order size | 0 | 1,000 |
| `reorder_point` | Trigger for ordering | 0 | 9,700 |
| `reorder_qty` | Default order quantity | 0 | 10,000 |
| `critical_days` | Critical urgency threshold | 7 | 7 |
| `warning_days` | Warning urgency threshold | 14 | 14 |
| `caution_days` | Caution urgency threshold | 30 | 30 |

---

## 🚀 Performance Optimizations

### 1. Caching

**MRP Results Cached:**
- Stored in `mrp_results` table
- Indexed by product_id and result_date
- Calculation timestamp tracked
- Re-calculate when data changes

### 2. Batch Processing

**Process All Products Together:**
```python
# Instead of per-product API calls
for product in all_products:
    calculate_mrp(product)

# Batch calculate in single pass
calculate_mrp_all_products()
```

### 3. Database Optimization

**Efficient Queries:**
- Use JOINs instead of N+1 queries
- Eager load relationships
- Index foreign keys
- Limit date ranges

---

## 📊 Data Inputs

### Required Data

1. **Weekly Shipment Goals**
   - Future production schedule
   - Minimum: 4-6 weeks
   - Optimal: 8-12 weeks

2. **Bill of Materials**
   - Complete and accurate BOMs
   - All component relationships defined
   - Correct quantity_per values

3. **Current Inventory**
   - Accurate on_hand quantities
   - Up-to-date allocated amounts

4. **Pending Purchase Orders**
   - All open POs entered
   - Accurate expected dates
   - Correct quantities

5. **Product Parameters**
   - Lead times
   - Safety stock levels
   - Order constraints

---

## 🎯 Accuracy Factors

**Calculation Accuracy Depends On:**

1. **Data Quality**
   - Garbage in = garbage out
   - Regular inventory cycle counts
   - BOM validation

2. **Forecast Horizon**
   - Longer = more uncertainty
   - Recommend 8-12 weeks optimal
   - Beyond 12 weeks, accuracy degrades

3. **Demand Stability**
   - Stable demand = accurate projections
   - Volatile demand = less predictable
   - Seasonality effects

4. **Lead Time Accuracy**
   - Supplier performance
   - Shipping delays
   - Safety stock compensates

---

## 🔍 Validation & Testing

### Verify Calculations

**Check BOM Explosion:**
```python
# Manual verification
finished_good_qty = 1
components = explode_bom(finished_good_id, finished_good_qty)

# Compare to expected values from product design
assert components[housing_id] == 2  # Should need 2 housings
```

**Check Daily Consumption:**
```python
# Test single product, single component
daily_consumption = calculate_consumption(
    product_id=1,
    component_id=5,
    date='2025-11-18'
)

# Verify: goal/5 * qty_per
expected = (2300 / 5) * 2  # 920
assert daily_consumption == expected
```

**Check Projection:**
```python
# Start with known inventory
start_inventory = 5000
consumption_per_day = 920
incoming_po_day_3 = 10000

# Project 5 days
projections = calculate_projection(component_id=5, days=5)

# Verify day 3
expected_day_3 = start_inventory - (920 * 2) + 10000  # 13,160
assert projections[2] == expected_day_3
```

---

## 📚 Related Documentation

- **[BOM Explosion](21_BOM_EXPLOSION.md)** - Detailed BOM processing
- **[Reorder Point Calculation](22_REORDER_POINT_CALCULATION.md)** - Reorder logic details
- **[API Reference](13_API_REFERENCE.md)** - MRP API endpoints
- **[Database Schema](12_DATABASE_SCHEMA.md)** - Data structure

---

*MRP calculation engine is the heart of the system. Ensure quality data inputs for accurate planning!*
