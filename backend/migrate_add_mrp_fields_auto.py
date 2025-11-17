"""
Database migration script to add MRP-specific fields to products table (Auto mode)

This script adds the following fields:
- safety_stock: Safety stock quantity
- order_multiple: Must order in multiples of this
- minimum_order_qty: Minimum order quantity

This version runs automatically without user prompt.
"""

import sqlite3
from pathlib import Path

def migrate_database():
    """Add new MRP fields to products table"""

    # Path to database
    db_path = Path(__file__).parent.parent / "data" / "mrp.db"

    if not db_path.exists():
        print(f"[ERROR] Database not found at {db_path}")
        print("Please run the application first to create the database.")
        return False

    print(f"[INFO] Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(products)")
        columns = [column[1] for column in cursor.fetchall()]

        fields_to_add = []

        if 'safety_stock' not in columns:
            fields_to_add.append(('safety_stock', 'NUMERIC(15, 2) DEFAULT 0'))

        if 'order_multiple' not in columns:
            fields_to_add.append(('order_multiple', 'NUMERIC(15, 2) DEFAULT 1'))

        if 'minimum_order_qty' not in columns:
            fields_to_add.append(('minimum_order_qty', 'NUMERIC(15, 2) DEFAULT 0'))

        if not fields_to_add:
            print("[SUCCESS] All fields already exist. No migration needed.")
            return True

        # Add missing columns
        for field_name, field_type in fields_to_add:
            sql = f"ALTER TABLE products ADD COLUMN {field_name} {field_type}"
            print(f"[INFO] Adding column: {field_name}")
            cursor.execute(sql)

        conn.commit()
        print(f"\n[SUCCESS] Successfully added {len(fields_to_add)} field(s) to products table:")
        for field_name, _ in fields_to_add:
            print(f"  - {field_name}")

        # Verify the changes
        cursor.execute("PRAGMA table_info(products)")
        columns = cursor.fetchall()
        print(f"\n[SUCCESS] Products table now has {len(columns)} columns")

        return True

    except Exception as e:
        print(f"[ERROR] Error during migration: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()
        print("\n[INFO] Database connection closed.")

if __name__ == "__main__":
    print("=" * 60)
    print("MRP Database Migration Script (Auto Mode)")
    print("=" * 60)
    print("\nAdding MRP-specific fields to products table...")
    print()

    success = migrate_database()

    if success:
        print("\n" + "=" * 60)
        print("[SUCCESS] MIGRATION COMPLETE!")
        print("=" * 60)
        exit(0)
    else:
        print("\n" + "=" * 60)
        print("[ERROR] MIGRATION FAILED")
        print("=" * 60)
        exit(1)
