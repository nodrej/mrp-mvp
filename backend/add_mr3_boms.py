"""
Add BOMs for MR3-TRIG-STR and MR3-TRIG-CURV
Both products use the same BOM except for the trigger body component
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
import models
from decimal import Decimal

db = SessionLocal()

try:
    print("=== ADDING MR3 TRIGGER BOMs ===\n")

    # Get product IDs
    mr3_str = db.query(models.Product).filter(models.Product.code == "MR3-TRIG-STR").first()
    mr3_curv = db.query(models.Product).filter(models.Product.code == "MR3-TRIG-CURV").first()

    if not mr3_str:
        print("ERROR: MR3-TRIG-STR not found!")
        exit(1)
    if not mr3_curv:
        print("ERROR: MR3-TRIG-CURV not found!")
        exit(1)

    print(f"Found MR3-TRIG-STR (ID: {mr3_str.id})")
    print(f"Found MR3-TRIG-CURV (ID: {mr3_curv.id})")

    # Update product name for MR3-TRIG-CURV (currently says "Straight" in the name)
    mr3_curv.name = "MR3 Trigger Assembly Curved Trigger"

    # Get all component IDs by code
    def get_product_id(code):
        prod = db.query(models.Product).filter(models.Product.code == code).first()
        if prod:
            return prod.id
        else:
            print(f"WARNING: Component {code} not found!")
            return None

    # Define the BOM (same for both except trigger body)
    # Format: (component_code, quantity)
    common_bom = [
        ("L3-HOUS", 1),              # L3 Housing
        ("MR3-LOCK-BAR", 1),         # MR3 Locking Bar
        ("MR3-HAM", 1),              # MR3 Hammer
        ("MR3-DISC", 1),             # MR3 Disconnect
        ("DOG-SCR", 1),              # Dog Screw
        ("AXLE-2MM", 1),             # Axles
        ("DOWEL-2MM", 1),            # 2mm x 10mm Dowel Pins
        ("SPR-LOCK", 1),             # Locking Bar Spring
        ("SPR-TRIG-32", 1),          # Trigger Spring 32 Deg
        ("SPR-HAM-55", 1),           # Hammer Spring 55 Deg
        ("SPR-DISC-GRN", 1),         # Disconnect Spring - Green
        ("ANTI-WALK", 2),            # Anti Walk Pins
        ("BTN-4-40", 4),             # 4-40 T10 Button Head
        ("T10-WRENCH", 2),           # T10 Wrench
        ("A1-SAFE-BODY", 1),         # A1 Safety Body
        ("A4-SAFE-BODY", 1),         # A4 Safety Body
        ("1.5MM-ROLL-PIN", 4),       # 1.5mm Roll Pins
        ("SAFE-SEL-S", 1),           # Safety Selector - Short
        ("SAFE-SEL-L", 1),           # Safety Selector - Long
    ]

    # Delete existing BOMs if any
    print("\nDeleting existing BOMs...")
    db.query(models.BOMLine).filter(models.BOMLine.parent_product_id == mr3_str.id).delete()
    db.query(models.BOMLine).filter(models.BOMLine.parent_product_id == mr3_curv.id).delete()
    db.commit()

    # Add BOM for MR3-TRIG-STR (with straight trigger body)
    print(f"\n=== Adding BOM for MR3-TRIG-STR ===")

    # Add straight trigger body
    str_body_id = get_product_id("L3-BODY-STR")
    if str_body_id:
        bom_line = models.BOMLine(
            parent_product_id=mr3_str.id,
            component_product_id=str_body_id,
            quantity_per=Decimal("1")
        )
        db.add(bom_line)
        print(f"  ✓ L3-BODY-STR x 1")

    # Add common components
    for code, qty in common_bom:
        comp_id = get_product_id(code)
        if comp_id:
            bom_line = models.BOMLine(
                parent_product_id=mr3_str.id,
                component_product_id=comp_id,
                quantity_per=Decimal(str(qty))
            )
            db.add(bom_line)
            print(f"  ✓ {code} x {qty}")

    # Add BOM for MR3-TRIG-CURV (with curved trigger body)
    print(f"\n=== Adding BOM for MR3-TRIG-CURV ===")

    # Add curved trigger body
    curv_body_id = get_product_id("L3-BODY-CURV")
    if curv_body_id:
        bom_line = models.BOMLine(
            parent_product_id=mr3_curv.id,
            component_product_id=curv_body_id,
            quantity_per=Decimal("1")
        )
        db.add(bom_line)
        print(f"  ✓ L3-BODY-CURV x 1")

    # Add common components
    for code, qty in common_bom:
        comp_id = get_product_id(code)
        if comp_id:
            bom_line = models.BOMLine(
                parent_product_id=mr3_curv.id,
                component_product_id=comp_id,
                quantity_per=Decimal(str(qty))
            )
            db.add(bom_line)
            print(f"  ✓ {code} x {qty}")

    db.commit()

    print("\n" + "="*60)
    print("✓ MR3 Trigger BOMs created successfully!")
    print("="*60)

    # Count BOM lines
    str_bom_count = db.query(models.BOMLine).filter(models.BOMLine.parent_product_id == mr3_str.id).count()
    curv_bom_count = db.query(models.BOMLine).filter(models.BOMLine.parent_product_id == mr3_curv.id).count()

    print(f"\nSummary:")
    print(f"  - MR3-TRIG-STR: {str_bom_count} BOM lines")
    print(f"  - MR3-TRIG-CURV: {curv_bom_count} BOM lines")

    # Create inventory records if they don't exist
    print("\n=== Creating inventory records ===")

    for product_id in [mr3_str.id, mr3_curv.id]:
        existing_inv = db.query(models.Inventory).filter(models.Inventory.product_id == product_id).first()
        if not existing_inv:
            inventory = models.Inventory(
                product_id=product_id,
                on_hand=Decimal(0),
                allocated=Decimal(0)
            )
            db.add(inventory)
            product = db.query(models.Product).filter(models.Product.id == product_id).first()
            print(f"  ✓ Created inventory for {product.code}")

    db.commit()
    print("\n✓ Inventory records created!")

except Exception as e:
    print(f"\n✗ Error: {e}")
    db.rollback()
    raise

finally:
    db.close()
