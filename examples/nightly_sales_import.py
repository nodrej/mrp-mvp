#!/usr/bin/env python3
"""
Nightly Sales Import Script for MRP System

This script imports yesterday's sales data into the MRP system.
Customize the get_sales_data() function to pull from your actual data source.

Schedule this to run every night at midnight using:
- Windows: Task Scheduler
- Linux/Mac: cron job

Author: MRP System
Date: 2024-11-12
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# ============================================================================
# CONFIGURATION
# ============================================================================

# MRP API endpoint
# For local development:
MRP_API_URL = "http://localhost:8000/api/sales/bulk-import"

# For production (replace with your server IP/hostname):
# MRP_API_URL = "http://192.168.1.100:8000/api/sales/bulk-import"

# Log file (optional)
LOG_FILE = "sales_import.log"

# ============================================================================
# DATA SOURCE FUNCTION - CUSTOMIZE THIS!
# ============================================================================

def get_sales_data():
    """
    Get sales data from your external system.

    CUSTOMIZE THIS FUNCTION to pull from your actual data source:
    - Database query
    - API call to your sales system
    - Read from CSV/Excel file
    - Parse from email reports
    - etc.

    Returns:
        dict: Sales data in the format:
        {
            "PRODUCT-CODE": [
                {"sale_date": "2024-11-12", "quantity_sold": 15, "notes": ""},
                ...
            ],
            ...
        }
    """

    # Example: Get yesterday's date
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')

    # TODO: Replace this example data with your actual data source
    # Example options:

    # Option 1: Read from CSV file
    # return read_sales_from_csv(f"sales_{yesterday}.csv")

    # Option 2: Query your database
    # return query_sales_database(yesterday)

    # Option 3: Call your external API
    # return fetch_from_external_api(yesterday)

    # Example data (REPLACE THIS):
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
                "quantity_sold": 22,
                "notes": ""
            }
        ],
        # Add more products here...
    }

    return sales_data

# ============================================================================
# HELPER FUNCTIONS (Examples)
# ============================================================================

def read_sales_from_csv(csv_file):
    """
    Example: Read sales from CSV file
    CSV format: product_code,sale_date,quantity_sold,notes
    """
    import csv
    from collections import defaultdict

    sales_by_product = defaultdict(list)

    try:
        with open(csv_file, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                sales_by_product[row['product_code']].append({
                    'sale_date': row['sale_date'],
                    'quantity_sold': int(row['quantity_sold']),
                    'notes': row.get('notes', '')
                })
        return dict(sales_by_product)
    except FileNotFoundError:
        print(f"CSV file not found: {csv_file}")
        return {}

def query_sales_database(sale_date):
    """
    Example: Query sales from your database
    CUSTOMIZE with your actual database connection
    """
    # import sqlite3  # or psycopg2, pymysql, etc.

    # conn = sqlite3.connect('your_sales_database.db')
    # cursor = conn.cursor()
    #
    # cursor.execute("""
    #     SELECT product_code, sale_date, SUM(quantity) as quantity_sold
    #     FROM sales
    #     WHERE sale_date = ?
    #     GROUP BY product_code, sale_date
    # """, (sale_date,))
    #
    # sales_by_product = {}
    # for row in cursor.fetchall():
    #     product_code = row[0]
    #     if product_code not in sales_by_product:
    #         sales_by_product[product_code] = []
    #     sales_by_product[product_code].append({
    #         'sale_date': row[1],
    #         'quantity_sold': row[2],
    #         'notes': ''
    #     })
    #
    # conn.close()
    # return sales_by_product

    return {}

def fetch_from_external_api(sale_date):
    """
    Example: Fetch sales from external API
    CUSTOMIZE with your actual API endpoint and credentials
    """
    # api_url = "https://your-external-system.com/api/sales"
    # headers = {"Authorization": "Bearer YOUR_API_KEY"}
    #
    # response = requests.get(
    #     api_url,
    #     params={"date": sale_date},
    #     headers=headers
    # )
    #
    # if response.status_code == 200:
    #     data = response.json()
    #     # Transform to required format
    #     sales_by_product = {}
    #     for sale in data['sales']:
    #         product_code = sale['product_code']
    #         if product_code not in sales_by_product:
    #             sales_by_product[product_code] = []
    #         sales_by_product[product_code].append({
    #             'sale_date': sale['date'],
    #             'quantity_sold': sale['quantity'],
    #             'notes': sale.get('notes', '')
    #         })
    #     return sales_by_product
    # else:
    #     print(f"API Error: {response.status_code}")
    #     return {}

    return {}

# ============================================================================
# IMPORT FUNCTION
# ============================================================================

def import_sales_to_mrp(sales_data):
    """
    Send sales data to MRP system via API

    Args:
        sales_data (dict): Sales data by product code

    Returns:
        bool: True if successful, False otherwise
    """

    if not sales_data:
        log_message("No sales data to import")
        return False

    payload = {
        "sales_by_product_code": sales_data
    }

    log_message(f"Importing sales for {len(sales_data)} products...")

    try:
        response = requests.post(
            MRP_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            log_message(f"✓ Success: {result['message']}")
            log_message(f"  Total records: {result['results']['total_records']}")

            # Log successes
            for success in result['results']['success']:
                log_message(f"  ✓ {success['product_code']}: {success['records_imported']} records")

            # Log errors
            if result['results']['errors']:
                log_message("  Errors encountered:")
                for error in result['results']['errors']:
                    log_message(f"  ✗ {error['product_code']}: {error['error']}")

            return True

        else:
            log_message(f"✗ HTTP Error {response.status_code}")
            log_message(f"  Response: {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        log_message("✗ Connection Error: Unable to reach MRP server")
        log_message(f"  Check that server is running at: {MRP_API_URL}")
        return False

    except requests.exceptions.Timeout:
        log_message("✗ Timeout Error: Request took too long")
        return False

    except requests.exceptions.RequestException as e:
        log_message(f"✗ Request Error: {e}")
        return False

    except Exception as e:
        log_message(f"✗ Unexpected Error: {e}")
        return False

# ============================================================================
# LOGGING
# ============================================================================

def log_message(message):
    """Write message to console and log file"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"[{timestamp}] {message}"

    # Print to console
    print(log_line)

    # Write to log file (optional)
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(log_line + '\n')
    except Exception as e:
        print(f"Warning: Could not write to log file: {e}")

# ============================================================================
# MAIN FUNCTION
# ============================================================================

def main():
    """Main execution function"""

    log_message("=" * 70)
    log_message("Starting Nightly Sales Import")
    log_message("=" * 70)

    try:
        # Get sales data from your system
        log_message("Step 1: Fetching sales data from external system...")
        sales_data = get_sales_data()

        if not sales_data:
            log_message("No sales data found. Exiting.")
            return 0

        log_message(f"Found sales data for {len(sales_data)} products")

        # Import to MRP system
        log_message("Step 2: Importing to MRP system...")
        success = import_sales_to_mrp(sales_data)

        # Summary
        log_message("=" * 70)
        if success:
            log_message("✓ Import completed successfully")
            log_message("=" * 70)
            return 0
        else:
            log_message("✗ Import failed")
            log_message("=" * 70)
            return 1

    except KeyboardInterrupt:
        log_message("\nImport cancelled by user")
        return 1

    except Exception as e:
        log_message(f"✗ Fatal Error: {e}")
        import traceback
        log_message(traceback.format_exc())
        return 1

# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
