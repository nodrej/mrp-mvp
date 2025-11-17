# API Reference

Complete REST API documentation for the MRP System backend.

---

## 🌐 Base URL

**Local Development:**
```
http://localhost:8000
```

**API Prefix:**
```
/api
```

**Interactive Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 📋 General Information

### Response Format

All responses are JSON format.

**Success Response:**
```json
{
  "id": 1,
  "code": "L3-TRIG",
  "name": "L3 Trigger Assembly",
  ...
}
```

**Error Response:**
```json
{
  "detail": "Error message here"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource doesn't exist |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error - Server-side error |

### Authentication

⚠️ **Current Version:** No authentication required (development/internal use)

For production, implement:
- JWT tokens
- API keys
- OAuth2

---

## 📦 API Endpoints

### Health Check

#### GET /
**Description:** API information and health check

**Response:**
```json
{
  "message": "MRP API is running",
  "version": "1.0"
}
```

#### GET /health
**Description:** Health status endpoint

**Response:**
```json
{
  "status": "healthy"
}
```

---

## 🏷️ Products API

### List Products

#### GET /api/products
**Description:** Get all products with optional filtering

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| search | string | No | Search by code or name |
| type | string | No | Filter by type: 'finished_good', 'sub_assembly', 'component', 'raw_material' |
| category | string | No | Filter by category |

**Example Request:**
```http
GET /api/products?type=finished_good&search=trigger
```

**Response:**
```json
[
  {
    "id": 1,
    "code": "L3-TRIG",
    "name": "L3 Trigger Assembly",
    "type": "finished_good",
    "uom": "each",
    "reorder_point": 500,
    "reorder_qty": 2000,
    "lead_time_days": 0,
    "safety_stock": 100,
    "order_multiple": 50,
    "minimum_order_qty": 500,
    "critical_days": 7,
    "warning_days": 14,
    "caution_days": 30,
    "category": "Trigger Assemblies",
    "supplier": null,
    "tags": null,
    "is_active": true,
    "created_at": "2025-11-15T10:00:00Z"
  }
]
```

### Get Single Product

#### GET /api/products/{product_id}
**Description:** Get specific product by ID

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_id | integer | Yes | Product ID |

**Response:** Same as single product object above

### Create Product

#### POST /api/products
**Description:** Create a new product

**Request Body:**
```json
{
  "code": "NEW-PROD",
  "name": "New Product",
  "type": "component",
  "uom": "each",
  "reorder_point": 100,
  "reorder_qty": 500,
  "lead_time_days": 14,
  "safety_stock": 50,
  "category": "Components"
}
```

**Required Fields:**
- code (unique)
- name
- type
- uom

**Response:** Created product object (status 200)

**Side Effect:** Automatically creates inventory record with 0 on_hand

### Update Product

#### PUT /api/products/{product_id}
**Description:** Update existing product

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_id | integer | Yes | Product ID |

**Request Body:** Same as create, but all fields optional

**Response:** Updated product object

### Delete Product

#### DELETE /api/products/{product_id}
**Description:** Soft delete product (sets is_active = False)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_id | integer | Yes | Product ID |

**Response:**
```json
{
  "message": "Product soft deleted successfully"
}
```

---

## 🔧 Bill of Materials API

### Get Product BOM

#### GET /api/products/{product_id}/bom
**Description:** Get all BOM lines for a product

**Response:**
```json
[
  {
    "id": 1,
    "component_product_id": 5,
    "component_code": "COMP-001",
    "component_name": "Housing",
    "quantity_per": "2.0000",
    "component_uom": "each"
  }
]
```

### Save Product BOM

#### POST /api/products/{product_id}/bom
**Description:** Save/update complete BOM for a product

**Request Body:**
```json
{
  "components": [
    {
      "component_product_id": 5,
      "quantity_per": 2.0
    },
    {
      "component_product_id": 6,
      "quantity_per": 1.0
    }
  ]
}
```

**Behavior:**
- Deletes existing BOM lines for this product
- Creates new BOM lines from request
- Atomic operation (all or nothing)

**Response:**
```json
{
  "message": "BOM saved successfully"
}
```

### Delete BOM Line

#### DELETE /api/bom/{bom_line_id}
**Description:** Delete single BOM line

**Response:**
```json
{
  "message": "BOM line deleted successfully"
}
```

---

## 📦 Inventory API

### Get All Inventory

#### GET /api/inventory
**Description:** Get inventory for all products

**Response:**
```json
[
  {
    "id": 1,
    "product_id": 1,
    "product_code": "L3-TRIG",
    "product_name": "L3 Trigger Assembly",
    "on_hand": "1500.00",
    "allocated": "100.00",
    "available": 1400.00,
    "reorder_point": "500.00",
    "status": "ok",
    "last_updated": "2025-11-15T10:30:00Z"
  }
]
```

**Status Values:**
- "ok" - above reorder point
- "low" - at or below reorder point
- "critical" - significantly below reorder point

### Get Product Inventory

#### GET /api/inventory/{product_id}
**Description:** Get inventory for specific product

**Response:** Single inventory object

### Adjust Inventory

#### POST /api/inventory/adjust
**Description:** Manually adjust inventory quantity

**Request Body:**
```json
{
  "product_id": 5,
  "quantity_change": 100,
  "reason": "Cycle Count Adjustment",
  "notes": "Correcting discrepancy found during audit"
}
```

**Response:**
```json
{
  "message": "Inventory adjusted successfully",
  "new_on_hand": 5100,
  "adjustment_id": 123
}
```

**Side Effects:**
- Updates inventory.on_hand
- Creates inventory_adjustments record
- Updates inventory.last_updated

### Get Pending Inventory

#### GET /api/inventory/pending
**Description:** Get pending purchase orders grouped by product

**Response:**
```json
[
  {
    "product_id": 5,
    "product_code": "COMP-001",
    "product_name": "Housing",
    "total_pending": "15000.00",
    "orders": [
      {
        "po_number": "PO-2025-001",
        "quantity": "10000.00",
        "expected_date": "2025-11-22"
      },
      {
        "po_number": "PO-2025-005",
        "quantity": "5000.00",
        "expected_date": "2025-11-29"
      }
    ]
  }
]
```

### Get Inventory Adjustment History

#### GET /api/inventory/adjustments/history
**Description:** Get complete inventory adjustment history

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_id | integer | No | Filter by product |
| start_date | date | No | Filter from date (YYYY-MM-DD) |
| end_date | date | No | Filter to date |
| reason | string | No | Filter by reason |

**Response:**
```json
[
  {
    "id": 123,
    "product_id": 5,
    "product_code": "COMP-001",
    "product_name": "Housing",
    "adjustment_date": "2025-11-15T14:30:00Z",
    "quantity_change": "100.00",
    "reason": "Cycle Count Adjustment",
    "notes": "Previous: 5000, New: 5100"
  }
]
```

---

## 📊 Demand & MRP API

### Get Product Demand

#### GET /api/demand/{product_id}
**Description:** Get demand forecast for a product

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| days | integer | No | Number of days to fetch (default: 30) |

**Response:**
```json
[
  {
    "demand_date": "2025-11-18",
    "quantity": "460.00"
  },
  {
    "demand_date": "2025-11-19",
    "quantity": "460.00"
  }
]
```

### Save Demand Forecast

#### POST /api/demand
**Description:** Save bulk demand forecast

**Request Body:**
```json
{
  "product_id": 1,
  "demands": [
    {
      "demand_date": "2025-11-18",
      "quantity": 460
    },
    {
      "demand_date": "2025-11-19",
      "quantity": 460
    }
  ]
}
```

**Behavior:** Upserts (updates existing, inserts new)

**Response:**
```json
{
  "message": "Demand saved successfully",
  "records_saved": 2
}
```

### Calculate MRP

#### POST /api/mrp/calculate
**Description:** Run MRP calculation for all products

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| days | integer | No | Days to project (default: 30) |

**Example Request:**
```http
POST /api/mrp/calculate?days=60
```

**Response:**
```json
{
  "message": "MRP calculated successfully",
  "products_calculated": 25,
  "shortages_detected": 8
}
```

**Processing Time:** 1-5 seconds depending on data size

### Get MRP Shortages

#### GET /api/mrp/shortages
**Description:** Get products with detected shortages

**Response:**
```json
[
  {
    "product_id": 5,
    "product_code": "COMP-001",
    "product_name": "Housing",
    "current_inventory": "5000.00",
    "shortage_date": "2025-11-25",
    "days_until_shortage": 10,
    "urgency": "warning",
    "recommended_order_qty": "10000.00"
  }
]
```

**Urgency Levels:**
- "critical" - shortage in ≤ 7 days
- "warning" - shortage in 8-14 days
- "caution" - shortage in 15-30 days
- "normal" - shortage > 30 days

### Daily Build Analysis

#### GET /api/demand/daily-build-analysis
**Description:** Component-level consumption forecast

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| days | integer | No | Days to project (default: 90) |

**Response:**
```json
{
  "analysis_date": "2025-11-15",
  "days_projected": 90,
  "components": [
    {
      "product_id": 5,
      "product_code": "COMP-001",
      "product_name": "Housing",
      "current_inventory": "5000.00",
      "daily_consumption": [
        {
          "date": "2025-11-18",
          "day_name": "Monday",
          "total_consumption": "920.00",
          "usage_breakdown": [
            {
              "parent_product": "L3-TRIG",
              "quantity_needed": "920.00"
            }
          ],
          "incoming_pos": [],
          "projected_inventory": "4080.00"
        }
      ],
      "run_out_date": "2025-11-25",
      "days_of_inventory": 10,
      "stagnant": false
    }
  ]
}
```

### Get Dynamic Reorder Points

#### GET /api/inventory/dynamic-reorder-points
**Description:** Calculate optimal reorder points based on demand

**Response:**
```json
[
  {
    "product_id": 5,
    "product_code": "COMP-001",
    "product_name": "Housing",
    "current_reorder_point": "5000.00",
    "recommended_reorder_point": "11040.00",
    "average_weekly_usage": "4600.00",
    "lead_time_days": 14,
    "safety_stock": "500.00",
    "calculation_details": {
      "weeks_analyzed": 6,
      "usage_pattern": "stable"
    }
  }
]
```

### Update Reorder Points

#### POST /api/inventory/update-reorder-points
**Description:** Apply calculated reorder points to products

**Request Body:**
```json
{
  "updates": [
    {
      "product_id": 5,
      "reorder_point": 11040
    }
  ]
}
```

**Response:**
```json
{
  "message": "Reorder points updated successfully",
  "updated_count": 1
}
```

---

## 📅 Sales & Shipping API

### Get Sales Summary

#### GET /api/sales/summary
**Description:** Get sales totals by product

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| start_date | date | No | From date (YYYY-MM-DD) |
| end_date | date | No | To date |

**Response:**
```json
[
  {
    "product_id": 1,
    "product_code": "L3-TRIG",
    "product_name": "L3 Trigger Assembly",
    "total_sold": "12500.00",
    "sale_count": 45
  }
]
```

### Get Product Sales History

#### GET /api/sales/{product_id}
**Description:** Get sales history for a product

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| days | integer | No | Number of days back (default: 30) |

**Response:**
```json
[
  {
    "id": 1,
    "sale_date": "2025-11-15",
    "quantity_sold": "450.00",
    "notes": "",
    "created_at": "2025-11-15T16:00:00Z"
  }
]
```

### Record Sale

#### POST /api/sales
**Description:** Record a single sale/shipment

**Request Body:**
```json
{
  "product_id": 1,
  "sale_date": "2025-11-15",
  "quantity_sold": 450,
  "notes": "Customer order #12345"
}
```

**Response:**
```json
{
  "message": "Sale recorded successfully",
  "inventory_updated": true,
  "components_updated": 19
}
```

**Side Effects:**
- Updates sales_history
- Reduces inventory for finished good
- Reduces inventory for all components (via BOM)
- Creates inventory_adjustments for all changes
- Updates weekly_shipments.shipped

### Bulk Import Sales

#### POST /api/sales/bulk-import
**Description:** Import multiple sales records for multiple products

**Request Body:**
```json
{
  "sales_by_product_code": {
    "L3-TRIG": [
      {
        "sale_date": "2025-11-15",
        "quantity_sold": 450
      },
      {
        "sale_date": "2025-11-16",
        "quantity_sold": 480
      }
    ],
    "L4-STRAIGHT": [
      {
        "sale_date": "2025-11-15",
        "quantity_sold": 200
      }
    ]
  }
}
```

**Response:**
```json
{
  "message": "Sales imported successfully",
  "products_processed": 2,
  "total_records": 3,
  "inventory_updates": 40
}
```

---

## 📆 Weekly Shipments API

### Get Weekly Shipments

#### GET /api/weekly-shipments/{product_id}
**Description:** Get weekly shipment data for a product

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| weeks | integer | No | Number of weeks (default: 8) |
| start_date | date | No | Start date (Monday, default: current week) |

**Example Request:**
```http
GET /api/weekly-shipments/1?weeks=12&start_date=2025-11-04
```

**Response:**
```json
{
  "product_id": 1,
  "product_code": "L3-TRIG",
  "product_name": "L3 Trigger Assembly",
  "shipments": [
    {
      "week_start_date": "2025-11-04",
      "goal": "2300.00",
      "shipped": "2150.00",
      "shipped_before_today": "2150.00",
      "notes": ""
    },
    {
      "week_start_date": "2025-11-11",
      "goal": "2300.00",
      "shipped": "1200.00",
      "shipped_before_today": "1200.00",
      "notes": ""
    }
  ]
}
```

### Save Weekly Shipments

#### POST /api/weekly-shipments
**Description:** Save weekly shipment goals for a product

**Request Body:**
```json
{
  "product_id": 1,
  "weeks": [
    {
      "week_start_date": "2025-11-18",
      "goal": 2300,
      "notes": ""
    },
    {
      "week_start_date": "2025-11-25",
      "goal": 2500,
      "notes": ""
    }
  ]
}
```

**Behavior:** Upserts (updates existing, inserts new)

**Response:**
```json
{
  "message": "Weekly shipments saved successfully",
  "records_saved": 2
}
```

### Get Current Week Summary

#### GET /api/weekly-shipments/current-week-summary
**Description:** Get current week performance for all products

**Response:**
```json
[
  {
    "product_id": 1,
    "product_code": "L3-TRIG",
    "product_name": "L3 Trigger Assembly",
    "week_start_date": "2025-11-18",
    "goal": "2300.00",
    "shipped": "920.00",
    "remaining": "1380.00",
    "achievement_pct": 40.0,
    "status": "on_pace"
  }
]
```

**Status Values:**
- "complete" - goal met
- "on_pace" - progressing well
- "behind" - behind schedule
- "close" - near goal

---

## 🛒 Purchase Orders API

### List Purchase Orders

#### GET /api/purchase-orders
**Description:** Get all purchase orders with optional filtering

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: 'pending', 'received', 'cancelled' |
| product_id | integer | No | Filter by product |

**Response:**
```json
{
  "purchase_orders": [
    {
      "id": 1,
      "po_number": "PO-2025-001",
      "product_id": 5,
      "product_code": "COMP-001",
      "product_name": "Housing",
      "order_date": "2025-11-15",
      "expected_date": "2025-11-22",
      "quantity": "10000.00",
      "status": "pending",
      "received_date": null,
      "received_quantity": null,
      "supplier": "Acme Manufacturing",
      "notes": "",
      "created_at": "2025-11-15T10:00:00Z"
    }
  ],
  "status_counts": {
    "pending": 5,
    "received": 23,
    "cancelled": 2
  }
}
```

### Get Single Purchase Order

#### GET /api/purchase-orders/{po_id}
**Description:** Get specific purchase order

**Response:** Single PO object (same structure as list item)

### Create Purchase Order

#### POST /api/purchase-orders
**Description:** Create new purchase order

**Request Body:**
```json
{
  "po_number": "PO-2025-010",
  "product_id": 5,
  "order_date": "2025-11-15",
  "expected_date": "2025-11-29",
  "quantity": 5000,
  "supplier": "Acme Manufacturing",
  "notes": "Rush order"
}
```

**Required Fields:**
- po_number (unique)
- product_id
- order_date
- expected_date
- quantity

**Response:** Created PO object

### Update Purchase Order

#### PUT /api/purchase-orders/{po_id}
**Description:** Update purchase order (before receipt)

**Request Body:** Same as create, all fields optional

**Response:** Updated PO object

### Receive Purchase Order

#### POST /api/purchase-orders/{po_id}/receive
**Description:** Mark PO as received and update inventory

**Request Body:**
```json
{
  "received_quantity": 10000,
  "received_date": "2025-11-22"
}
```

**Response:**
```json
{
  "message": "Purchase order received successfully",
  "inventory_updated": true,
  "new_inventory_level": "15000.00"
}
```

**Side Effects:**
- Updates PO status to 'received'
- Sets received_date and received_quantity
- Increases inventory.on_hand
- Creates inventory_adjustments record

### Undo PO Receipt

#### POST /api/purchase-orders/{po_id}/undo-receipt
**Description:** Reverse a PO receipt (for corrections)

**Response:**
```json
{
  "message": "Receipt undone successfully"
}
```

**Side Effects:**
- Reverts PO status to 'pending'
- Clears received_date and received_quantity
- Reduces inventory.on_hand
- Creates inventory_adjustments record (negative)

### Delete Purchase Order

#### DELETE /api/purchase-orders/{po_id}
**Description:** Delete or cancel purchase order

**Response:**
```json
{
  "message": "Purchase order deleted/cancelled successfully"
}
```

**Behavior:**
- If status = 'pending': Deletes record
- If status = 'received': Returns error (cannot delete received PO)
- Alternative: Updates status to 'cancelled'

---

## 📈 Dashboard API

### Get Dashboard Data

#### GET /api/dashboard
**Description:** Get executive summary dashboard data

**Response:**
```json
{
  "products": {
    "total": 20,
    "finished_goods": 2,
    "components": 18,
    "active": 20
  },
  "inventory": {
    "total_items": 20,
    "low_stock_count": 3,
    "out_of_stock_count": 0,
    "total_value": "125000.00"
  },
  "shortages": [
    {
      "product_code": "COMP-001",
      "product_name": "Housing",
      "current_inventory": "5000.00",
      "shortage_date": "2025-11-25",
      "days_until_shortage": 10,
      "urgency": "warning",
      "recommended_order_qty": "10000.00"
    }
  ],
  "recent_sales": {
    "last_7_days": "9500.00",
    "last_30_days": "38000.00"
  }
}
```

---

## 🔍 Search & Filter

### Global Search

#### GET /api/search
**Description:** Search across all entities

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query |
| entity | string | No | Limit to: 'products', 'pos', 'sales' |

**Response:**
```json
{
  "products": [...],
  "purchase_orders": [...],
  "sales_history": [...]
}
```

---

## 🔄 Batch Operations

### Batch Update Inventory

#### POST /api/inventory/batch-adjust
**Description:** Adjust multiple products at once

**Request Body:**
```json
{
  "adjustments": [
    {
      "product_id": 5,
      "quantity_change": 100,
      "reason": "Cycle Count"
    },
    {
      "product_id": 6,
      "quantity_change": -50,
      "reason": "Damage"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Batch adjustments completed",
  "successful": 2,
  "failed": 0
}
```

---

## 📊 Export API

### Export to CSV

#### GET /api/export/{entity}
**Description:** Export data to CSV format

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| entity | string | Yes | Entity to export: 'products', 'inventory', 'sales', 'pos' |

**Response:** CSV file download

**Example:**
```http
GET /api/export/inventory
Content-Type: text/csv
Content-Disposition: attachment; filename=inventory_20251115.csv
```

---

## 🛠️ Integration Examples

### Python Example

```python
import requests

BASE_URL = "http://localhost:8000/api"

# Get all finished goods
response = requests.get(f"{BASE_URL}/products", params={
    "type": "finished_good"
})
products = response.json()

# Record a sale
response = requests.post(f"{BASE_URL}/sales", json={
    "product_id": 1,
    "sale_date": "2025-11-15",
    "quantity_sold": 450
})
print(response.json())

# Run MRP calculation
response = requests.post(f"{BASE_URL}/mrp/calculate", params={
    "days": 60
})
print(response.json())
```

### JavaScript Example

```javascript
const BASE_URL = "http://localhost:8000/api";

// Get inventory
async function getInventory() {
  const response = await fetch(`${BASE_URL}/inventory`);
  const data = await response.json();
  return data;
}

// Create purchase order
async function createPO(poData) {
  const response = await fetch(`${BASE_URL}/purchase-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(poData)
  });
  return await response.json();
}
```

### cURL Examples

```bash
# Health check
curl http://localhost:8000/health

# Get products
curl http://localhost:8000/api/products

# Create product
curl -X POST http://localhost:8000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "code": "NEW-PROD",
    "name": "New Product",
    "type": "component",
    "uom": "each"
  }'

# Run MRP
curl -X POST http://localhost:8000/api/mrp/calculate?days=60
```

---

## ⚠️ Rate Limiting

**Current:** No rate limiting

**Recommended for Production:**
- 100 requests per minute per IP
- 1000 requests per hour per API key

---

## 📚 Related Documentation

- **[Database Schema](12_DATABASE_SCHEMA.md)** - Data structure reference
- **[Architecture](11_ARCHITECTURE.md)** - System design
- **[Developer Setup](16_DEVELOPER_SETUP.md)** - Development environment

---

*API Version: 1.0 | Last updated: November 15, 2025*
