"""
Migration: Add product organization fields (category, supplier, tags)
Run this script to add new columns to the products table
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal, engine
import models
from sqlalchemy import text
import json

def migrate():
    """Add category, supplier, and tags columns to products table"""

    print("="*70)
    print("MIGRATION: Add Product Organization Fields")
    print("="*70)

    db = SessionLocal()

    try:
        # Check if columns already exist
        result = db.execute(text("PRAGMA table_info(products)"))
        columns = [row[1] for row in result]

        print(f"\nCurrent columns in products table: {len(columns)}")

        # Add category column if it doesn't exist
        if 'category' not in columns:
            print("\n✓ Adding 'category' column...")
            db.execute(text("ALTER TABLE products ADD COLUMN category VARCHAR(50)"))
            db.commit()
            print("  Category column added successfully")
        else:
            print("\n  'category' column already exists")

        # Add supplier column if it doesn't exist
        if 'supplier' not in columns:
            print("\n✓ Adding 'supplier' column...")
            db.execute(text("ALTER TABLE products ADD COLUMN supplier VARCHAR(100)"))
            db.commit()
            print("  Supplier column added successfully")
        else:
            print("\n  'supplier' column already exists")

        # Add tags column if it doesn't exist
        if 'tags' not in columns:
            print("\n✓ Adding 'tags' column...")
            db.execute(text("ALTER TABLE products ADD COLUMN tags TEXT"))
            db.commit()
            print("  Tags column added successfully")
        else:
            print("\n  'tags' column already exists")

        # Auto-populate categories based on product code patterns
        print("\n" + "="*70)
        print("AUTO-POPULATING CATEGORIES")
        print("="*70)

        products = db.query(models.Product).all()
        updated_count = 0

        for product in products:
            category = None
            tags = []

            # Determine category based on code and type
            if product.type == 'finished_good':
                category = "Finished Goods"
            elif product.code.startswith('L3-'):
                if 'BODY' in product.code:
                    category = "Trigger Bodies"
                elif any(x in product.code for x in ['HOUS', 'HAM', 'DISC', 'LOCK']):
                    category = "L3 Components"
            elif product.code.startswith('MR3-'):
                category = "MR3 Components"
            elif product.code.startswith('SPR-'):
                category = "Springs"
            elif any(x in product.code for x in ['SAFE', 'A1-', 'A4-']):
                category = "Safety Components"
            elif any(x in product.code for x in ['BTN', 'FLAT', 'AXLE', 'DOWEL', 'PIN', 'SCR', 'WRENCH']):
                category = "Hardware & Fasteners"
            else:
                category = "Other Components"

            # Auto-tag based on characteristics
            if product.lead_time_days and product.lead_time_days > 60:
                tags.append("long-lead")

            if product.lead_time_days and product.lead_time_days <= 7:
                tags.append("short-lead")

            # Update product
            product.category = category
            if tags:
                product.tags = json.dumps(tags)

            updated_count += 1
            print(f"  {product.code:20s} → {category:25s} {tags}")

        db.commit()

        print("\n" + "="*70)
        print(f"✓ Migration completed successfully!")
        print(f"  - {updated_count} products categorized")
        print("="*70)

        # Show category distribution
        print("\nCategory Distribution:")
        category_counts = {}
        for product in products:
            cat = product.category or "Uncategorized"
            category_counts[cat] = category_counts.get(cat, 0) + 1

        for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {cat:30s}: {count} products")

    except Exception as e:
        print(f"\n✗ Error during migration: {e}")
        db.rollback()
        raise

    finally:
        db.close()

if __name__ == "__main__":
    migrate()
