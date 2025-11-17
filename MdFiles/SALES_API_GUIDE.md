# Sales Data API Integration Guide

This guide explains how to integrate your external sales tracking system with the MRP application to automatically update sales data every night.

## API Endpoints Overview

### 1. Single Product Sales Update (Existing)
**Endpoint**: `POST /api/sales`
**Use case**: Manual entry through the UI or updating one product at a time

### 2. Bulk Multi-Product Sales Import (NEW)
**Endpoint**: `POST /api/sales/bulk-import`
**Use case**: Nightly automated updates for multiple products

---

## Bulk Import API Details

### Endpoint
```
POST http://localhost:8000/api/sales/bulk-import
```

### Request Format
```json
{
  "sales_by_product_code": {
    "TRIG-001": [
      {
        "sale_date": "2024-11-12",
        "quantity_sold": 15,
        "notes": "Regular sales"
      },
      {
        "sale_date": "2024-11-13",
        "quantity_sold": 8
      }
    ],
    "TRIG-002": [
      {
        "sale_date": "2024-11-12",
        "quantity_sold": 22
      }
    ]
  }
}
```

### Response Format
```json
{
  "message": "Import complete. 3 records imported.",
  "results": {
    "success": [
      {
        "product_code": "TRIG-001",
        "product_name": "Trigger Assembly - Type A",
        "records_imported": 2
      },
      {
        "product_code": "TRIG-002",
        "product_name": "Trigger Assembly - Type B",
        "records_imported": 1
      }
    ],
    "errors": [],
    "total_records": 3
  }
}
```

### Key Features
- **Upsert behavior**: Automatically replaces existing sales data for the same date
- **Product code lookup**: Uses product codes (not IDs) for easier integration
- **Error handling**: Returns success/error status for each product
- **Batch processing**: Update multiple products in a single API call

---

## Automation Scripts

### Python Example (Recommended for Nightly Updates)

```python
#!/usr/bin/env python3
"""
Nightly Sales Import Script
Run this script via cron/Task Scheduler every night at midnight
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
MRP_API_URL = "http://localhost:8000/api/sales/bulk-import"
# For production, use: http://your-server-ip:8000/api/sales/bulk-import

def get_sales_data_from_your_system():
    """
    Replace this function with your actual data source.
    This could be:
    - Reading from a database
    - Pulling from an API
    - Reading from a CSV file
    - Querying your existing sales tracking system
    """

    # Example: Get yesterday's sales
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')

    # Example data structure - replace with your actual data
    sales_data = {
        "TRIG-001": [
            {
                "sale_date": yesterday,
                "quantity_sold": 15,
                "notes": "Auto-imported from external system"
            }
        ],
        "TRIG-002": [
            {
                "sale_date": yesterday,
                "quantity_sold": 22
            }
        ],
        # Add more products...
    }

    return sales_data

def import_sales_to_mrp(sales_data):
    """Send sales data to MRP system"""

    payload = {
        "sales_by_product_code": sales_data
    }

    try:
        response = requests.post(
            MRP_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✓ Success: {result['message']}")
            print(f"  Total records: {result['results']['total_records']}")

            # Log successes
            for success in result['results']['success']:
                print(f"  ✓ {success['product_code']}: {success['records_imported']} records")

            # Log errors
            for error in result['results']['errors']:
                print(f"  ✗ {error['product_code']}: {error['error']}")

            return True
        else:
            print(f"✗ Error: HTTP {response.status_code}")
            print(f"  {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"✗ Connection Error: {e}")
        return False

def main():
    print(f"Starting sales import at {datetime.now()}")
    print("-" * 50)

    # Get sales data from your system
    sales_data = get_sales_data_from_your_system()

    if not sales_data:
        print("No sales data to import")
        return

    # Import to MRP system
    success = import_sales_to_mrp(sales_data)

    if success:
        print("\n✓ Import completed successfully")
    else:
        print("\n✗ Import failed")

    print("-" * 50)

if __name__ == "__main__":
    main()
```

### PowerShell Example (Windows Task Scheduler)

```powershell
# save as: import-sales.ps1
# Schedule in Task Scheduler to run nightly

$MRP_API_URL = "http://localhost:8000/api/sales/bulk-import"
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")

# Build your sales data
$salesData = @{
    sales_by_product_code = @{
        "TRIG-001" = @(
            @{
                sale_date = $yesterday
                quantity_sold = 15
                notes = "Auto-imported"
            }
        )
        "TRIG-002" = @(
            @{
                sale_date = $yesterday
                quantity_sold = 22
            }
        )
    }
}

# Convert to JSON
$jsonPayload = $salesData | ConvertTo-Json -Depth 10

# Send to API
try {
    $response = Invoke-RestMethod -Uri $MRP_API_URL -Method Post -Body $jsonPayload -ContentType "application/json"
    Write-Host "✓ Success: $($response.message)"
    Write-Host "  Total records: $($response.results.total_records)"
} catch {
    Write-Host "✗ Error: $_"
    exit 1
}
```

### CSV Import Example

If your sales data comes from a CSV file:

```python
import csv
import requests
from datetime import datetime
from collections import defaultdict

def import_from_csv(csv_file_path):
    """
    Import sales from CSV file with columns:
    product_code, sale_date, quantity_sold, notes
    """

    # Group sales by product code
    sales_by_product = defaultdict(list)

    with open(csv_file_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            sales_by_product[row['product_code']].append({
                'sale_date': row['sale_date'],
                'quantity_sold': int(row['quantity_sold']),
                'notes': row.get('notes', '')
            })

    # Send to API
    payload = {"sales_by_product_code": dict(sales_by_product)}

    response = requests.post(
        "http://localhost:8000/api/sales/bulk-import",
        json=payload
    )

    print(response.json())

# Usage
import_from_csv("daily_sales_2024-11-12.csv")
```

---

## Scheduling the Automation

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. **Trigger**: Daily at 12:01 AM
4. **Action**: Start a program
   - **Program**: `python` (or `powershell`)
   - **Arguments**: `C:\path\to\import_sales.py`
5. **Conditions**:
   - ✓ Wake the computer to run this task
   - ✓ Run whether user is logged on or not

### Linux/Mac Cron Job

```bash
# Edit crontab
crontab -e

# Add this line to run daily at midnight
0 0 * * * /usr/bin/python3 /path/to/import_sales.py >> /var/log/sales_import.log 2>&1
```

---

## Testing the API

### Using curl (Command Line)

```bash
curl -X POST http://localhost:8000/api/sales/bulk-import \
  -H "Content-Type: application/json" \
  -d '{
    "sales_by_product_code": {
      "TRIG-001": [
        {
          "sale_date": "2024-11-12",
          "quantity_sold": 15
        }
      ]
    }
  }'
```

### Using Postman

1. Create new POST request
2. URL: `http://localhost:8000/api/sales/bulk-import`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "sales_by_product_code": {
    "TRIG-001": [
      {"sale_date": "2024-11-12", "quantity_sold": 15}
    ]
  }
}
```

---

## Important Notes

### Product Codes
- Use your actual product codes (e.g., "TRIG-001", "TRIG-002")
- Product codes are case-sensitive
- The product must exist in the system before importing sales

### Date Format
- Always use ISO format: `YYYY-MM-DD`
- Example: `"2024-11-12"`

### Quantity
- Must be a positive number
- Can be integer or decimal
- System will handle whole numbers as expected

### Upsert Behavior
- If sales data already exists for a date, it will be **replaced**
- This means you can safely re-run the import if it fails partway through

### Error Handling
- The API continues processing even if one product fails
- Check the `results.errors` array in the response
- Common errors:
  - Product code not found
  - Invalid date format
  - Missing required fields

---

## Impact on System

When sales data is imported, it **immediately affects**:

1. **Sales History page** - New data appears in both Data Entry and Analytics views
2. **Weekly Shipments calculation** - If you use sales history to set weekly goals
3. **Daily Build Analysis** - Material consumption projections update based on demand
4. **Dashboard** - Material shortage calculations reflect new demand patterns
5. **Inventory Planning** - Run-out dates and reorder recommendations update

**Important**: Changes are live immediately after the API call succeeds. The system automatically recalculates all dependent forecasts and projections.

---

## Troubleshooting

### API Returns 404
- Check that the backend server is running
- Verify the URL is correct (port 8000 by default)

### Product Not Found Errors
- Verify product codes match exactly (case-sensitive)
- Check product codes in the UI: **Products & BOM** page

### Import Appears Successful but Data Not Visible
- Hard refresh browser (Ctrl+F5)
- Check the date range filter on the Sales History page
- Verify you're looking at the correct product

### Permission Denied / Connection Refused
- Ensure the backend server is accessible from the machine running the script
- Check firewall rules if running on a different machine
- For remote access, replace `localhost` with the server IP address

---

## Security Considerations

### For Production Deployment

1. **Add Authentication**:
   - Implement API keys or OAuth tokens
   - Don't expose the API to the public internet without auth

2. **Use HTTPS**:
   - Configure SSL/TLS certificates
   - Never send data over unencrypted HTTP in production

3. **Network Security**:
   - Use VPN or private network for API access
   - Restrict access by IP address if possible
   - Consider rate limiting

4. **Logging**:
   - Log all import attempts with timestamps
   - Monitor for suspicious activity
   - Set up alerts for repeated failures

---

## Need Help?

**Common Issues**:
- Product codes must match exactly
- Date format must be YYYY-MM-DD
- Make sure backend server is running
- Check that products exist in the system first

**Testing Tip**: Start by importing just yesterday's data for one product, then expand to all products once it works.

---

## Example: Complete End-to-End Flow

1. **Your external system** tracks sales throughout the day
2. **At midnight**, your scheduled script runs
3. **Script queries** your external system for yesterday's sales
4. **Script formats** the data as JSON with product codes
5. **Script POSTs** to `/api/sales/bulk-import`
6. **MRP system** updates the database
7. **Next morning**, users see updated:
   - Sales history data
   - Demand forecasts
   - Material projections
   - Inventory recommendations

This creates a **fully automated pipeline** from your sales tracking to your production planning!
