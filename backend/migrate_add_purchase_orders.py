"""
Database migration script to add purchase_orders table

This script adds a new table for tracking purchase orders and incoming inventory.
"""

import sqlite3
from pathlib import Path

def migrate_database():
    """Add purchase_orders table to database"""

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
        # Check if table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_orders'")
        if cursor.fetchone():
            print("[SUCCESS] purchase_orders table already exists. No migration needed.")
            return True

        # Create purchase_orders table
        print("[INFO] Creating purchase_orders table...")
        cursor.execute("""
            CREATE TABLE purchase_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                po_number VARCHAR(50) UNIQUE NOT NULL,
                product_id INTEGER NOT NULL,
                order_date DATE NOT NULL,
                expected_date DATE NOT NULL,
                quantity NUMERIC(15, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                received_date DATE,
                received_quantity NUMERIC(15, 2),
                supplier VARCHAR(200),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        """)

        # Create indexes
        print("[INFO] Creating indexes...")
        cursor.execute("CREATE INDEX idx_po_number ON purchase_orders(po_number)")
        cursor.execute("CREATE INDEX idx_po_product_id ON purchase_orders(product_id)")
        cursor.execute("CREATE INDEX idx_po_status ON purchase_orders(status)")
        cursor.execute("CREATE INDEX idx_po_expected_date ON purchase_orders(expected_date)")

        conn.commit()
        print("\n[SUCCESS] Successfully created purchase_orders table")

        # Verify the table
        cursor.execute("PRAGMA table_info(purchase_orders)")
        columns = cursor.fetchall()
        print(f"\n[SUCCESS] purchase_orders table has {len(columns)} columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

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
    print("Purchase Orders Migration Script")
    print("=" * 60)
    print("\nAdding purchase_orders table...")
    print()

    success = migrate_database()

    if success:
        print("\n" + "=" * 60)
        print("[SUCCESS] MIGRATION COMPLETE!")
        print("=" * 60)
        print("\nYou can now track purchase orders and incoming inventory!")
        exit(0)
    else:
        print("\n" + "=" * 60)
        print("[ERROR] MIGRATION FAILED")
        print("=" * 60)
        exit(1)
