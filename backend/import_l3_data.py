"""
Import L3 Trigger data from existing CSV files
Run this script once to populate the database with your current L3 Trigger data
"""

import csv
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, init_db
import models

def import_l3_data():
    """Import L3 Trigger data from CSV files"""

    print("Starting L3 Trigger data import...")

    # Initialize database
    init_db()
    db = SessionLocal()

    try:
        # Step 1: Create L3 Trigger Assembly product
        print("\n1. Creating L3 Trigger Assembly product...")
        l3_trigger = models.Product(
            code="L3-TRIG",
            name="L3 Trigger Assembly",
            type="finished_good",
            uom="Each",
            reorder_point=0,  # Finished goods don't have reorder points
            reorder_qty=0,
            lead_time_days=5,  # Assembly lead time
            is_active=True
        )
        db.add(l3_trigger)
        db.commit()
        db.refresh(l3_trigger)
        print(f"   Created product: {l3_trigger.code} (ID: {l3_trigger.id})")

        # Step 2: Create component products (from your BOM)
        print("\n2. Creating component products...")
        components = [
            # Manufactured Parts
            {"code": "L3-HOUS", "name": "L3 Housing", "type": "component", "uom": "Each", "reorder_point": 736, "reorder_qty": 2500, "lead_time_days": 3},
            {"code": "L3-BODY", "name": "L3 Trigger Body", "type": "component", "uom": "Each", "reorder_point": 2910, "reorder_qty": 2000, "lead_time_days": 16},
            {"code": "LOCK-BAR", "name": "Locking Bar", "type": "component", "uom": "Each", "reorder_point": 1418, "reorder_qty": 3000, "lead_time_days": 7},
            {"code": "L3-HAM", "name": "L3 Hammer", "type": "component", "uom": "Each", "reorder_point": 1454, "reorder_qty": 2000, "lead_time_days": 8},
            {"code": "L3-DISC", "name": "L3 Disconnect", "type": "component", "uom": "Each", "reorder_point": 1835, "reorder_qty": 2000, "lead_time_days": 3},

            # Sourced Hardware
            {"code": "DOG-SCR", "name": "Dog Screw", "type": "component", "uom": "Each", "reorder_point": 2600, "reorder_qty": 22500, "lead_time_days": 22},
            {"code": "AXLE-2MM", "name": "Axles 2mm", "type": "component", "uom": "Each", "reorder_point": 17356, "reorder_qty": 30000, "lead_time_days": 63},
            {"code": "DOWEL-2MM", "name": "2mm x 10mm Dowel Pins", "type": "component", "uom": "Each", "reorder_point": 140000, "reorder_qty": 175000, "lead_time_days": 90},

            # Springs
            {"code": "SPR-LOCK", "name": "Locking Bar Spring", "type": "component", "uom": "Each", "reorder_point": 9649, "reorder_qty": 45000, "lead_time_days": 28},
            {"code": "SPR-TRIG-32", "name": "Trigger Spring - 32 Deg", "type": "component", "uom": "Each", "reorder_point": 34949, "reorder_qty": 42000, "lead_time_days": 92},
            {"code": "SPR-HAM-55", "name": "Hammer Spring - 55 Deg", "type": "component", "uom": "Each", "reorder_point": 34949, "reorder_qty": 42000, "lead_time_days": 92},
            {"code": "SPR-DISC-GRN", "name": "Disconnect Spring - Green", "type": "component", "uom": "Each", "reorder_point": 50800, "reorder_qty": 40000, "lead_time_days": 90},

            # Hardware Bag Components
            {"code": "ANTI-WALK", "name": "Anti Walk Pins", "type": "component", "uom": "Each", "reorder_point": 9045, "reorder_qty": 67500, "lead_time_days": 13},
            {"code": "BTN-4-40", "name": "4-40 T10 Button Head", "type": "component", "uom": "Each", "reorder_point": 240000, "reorder_qty": 309000, "lead_time_days": 60},
            {"code": "T10-WRENCH", "name": "T10 Wrench", "type": "component", "uom": "Each", "reorder_point": 138998, "reorder_qty": 173100, "lead_time_days": 60},
            {"code": "FLAT-4-40", "name": "4-40 Flat Head", "type": "component", "uom": "Each", "reorder_point": 244998, "reorder_qty": 279100, "lead_time_days": 60},
            {"code": "SAFE-BODY", "name": "Safety Body", "type": "component", "uom": "Each", "reorder_point": 4074, "reorder_qty": 27500, "lead_time_days": 10},
            {"code": "SAFE-SEL-S", "name": "Safety Selector - Short", "type": "component", "uom": "Each", "reorder_point": 3407, "reorder_qty": 20000, "lead_time_days": 20},
            {"code": "SAFE-SEL-L", "name": "Safety Selector - Long", "type": "component", "uom": "Each", "reorder_point": 3612, "reorder_qty": 20000, "lead_time_days": 20},
        ]

        component_map = {}
        for comp in components:
            db_comp = models.Product(**comp)
            db.add(db_comp)
            db.commit()
            db.refresh(db_comp)
            component_map[comp['code']] = db_comp.id
            print(f"   Created: {comp['code']} (ID: {db_comp.id})")

        # Step 3: Create BOM for L3 Trigger
        print("\n3. Creating BOM for L3 Trigger...")
        bom_data = [
            {"component": "L3-HOUS", "qty": 1.0},
            {"component": "L3-BODY", "qty": 1.0},
            {"component": "LOCK-BAR", "qty": 1.0},
            {"component": "L3-HAM", "qty": 1.0},
            {"component": "L3-DISC", "qty": 1.0},
            {"component": "DOG-SCR", "qty": 1.0},
            {"component": "AXLE-2MM", "qty": 2.0},  # 2 per trigger
            {"component": "DOWEL-2MM", "qty": 2.0},  # 2 per trigger
            {"component": "SPR-LOCK", "qty": 1.0},
            {"component": "SPR-TRIG-32", "qty": 1.0},
            {"component": "SPR-HAM-55", "qty": 1.0},
            {"component": "SPR-DISC-GRN", "qty": 1.0},
            {"component": "ANTI-WALK", "qty": 2.0},  # 2 per trigger
            {"component": "BTN-4-40", "qty": 4.0},  # 4 per trigger
            {"component": "T10-WRENCH", "qty": 2.0},  # 2 per trigger
            {"component": "FLAT-4-40", "qty": 2.0},  # 2 per trigger
            {"component": "SAFE-BODY", "qty": 1.0},
            {"component": "SAFE-SEL-S", "qty": 1.0},
            {"component": "SAFE-SEL-L", "qty": 1.0},
        ]

        for bom in bom_data:
            db_bom = models.BOMLine(
                parent_product_id=l3_trigger.id,
                component_product_id=component_map[bom['component']],
                quantity_per=Decimal(str(bom['qty']))
            )
            db.add(db_bom)
            print(f"   Added: {bom['component']} x {bom['qty']}")

        db.commit()

        # Step 4: Set current inventory levels (from L3 Available.csv)
        print("\n4. Setting current inventory levels...")
        inventory_data = {
            "L3-HOUS": 736,
            "L3-BODY": 2910,
            "LOCK-BAR": 1418,
            "L3-HAM": 1454,
            "L3-DISC": 1835,
            "DOG-SCR": 4771,
            "AXLE-2MM": 17356,
            "DOWEL-2MM": 140898,
            "SPR-LOCK": 9649,
            "SPR-TRIG-32": 34949,
            "SPR-HAM-55": 34949,
            "SPR-DISC-GRN": 50800,
            "ANTI-WALK": 9045,
            "BTN-4-40": 240796,
            "T10-WRENCH": 138998,
            "FLAT-4-40": 244998,
            "SAFE-BODY": 4074,
            "SAFE-SEL-S": 3407,
            "SAFE-SEL-L": 3612,
        }

        for code, qty in inventory_data.items():
            product_id = component_map[code]
            inventory = models.Inventory(
                product_id=product_id,
                on_hand=Decimal(str(qty)),
                allocated=Decimal(0)
            )
            db.add(inventory)
            print(f"   Set inventory: {code} = {qty}")

        # Add inventory for L3 Trigger (finished goods)
        l3_inventory = models.Inventory(
            product_id=l3_trigger.id,
            on_hand=Decimal(0),
            allocated=Decimal(0)
        )
        db.add(l3_inventory)

        db.commit()

        # Step 5: Add demand forecast (next 30 days with 2750 units/week = ~550/day weekdays)
        print("\n5. Adding demand forecast (30 days)...")
        start_date = date.today()
        daily_demand = 550  # Approximate weekday demand

        for day_offset in range(30):
            demand_date = start_date + timedelta(days=day_offset)

            # Only add demand for weekdays (Mon-Fri)
            if demand_date.weekday() < 5:  # 0-4 = Mon-Fri
                demand = models.DailyDemand(
                    product_id=l3_trigger.id,
                    demand_date=demand_date,
                    quantity=Decimal(str(daily_demand))
                )
                db.add(demand)

        db.commit()
        print(f"   Added demand forecast for next 30 days (weekdays only)")

        print("\n" + "="*60)
        print("✓ L3 Trigger data import completed successfully!")
        print("="*60)
        print(f"\nSummary:")
        print(f"  - 1 Finished Good: L3 Trigger Assembly")
        print(f"  - {len(components)} Components")
        print(f"  - {len(bom_data)} BOM Lines")
        print(f"  - {len(inventory_data)} Inventory Records")
        print(f"  - ~20 Demand Forecast Records")
        print(f"\nNext steps:")
        print(f"  1. Start the backend: python main.py")
        print(f"  2. Test API: http://localhost:8000/docs")
        print(f"  3. Run MRP: POST /api/mrp/calculate")

    except Exception as e:
        print(f"\n✗ Error during import: {e}")
        db.rollback()
        raise

    finally:
        db.close()

if __name__ == "__main__":
    import_l3_data()
