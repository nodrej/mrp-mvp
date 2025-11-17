from database import SessionLocal
from models import Product, BOMLine, Inventory
from decimal import Decimal

def create_straight_trigger():
    db = SessionLocal()

    try:
        # Step 1: Create new component "L3 Trigger Body Straight"
        print("Step 1: Creating L3 Trigger Body Straight component...")

        # Get the original L3 Trigger Body to copy its specs
        original_body = db.query(Product).filter(Product.code == 'L3-BODY').first()

        # Check if the straight body already exists
        existing_straight_body = db.query(Product).filter(Product.code == 'L3-BODY-STR').first()

        if existing_straight_body:
            print(f"  L3 Trigger Body Straight already exists (ID: {existing_straight_body.id})")
            straight_body = existing_straight_body
        else:
            straight_body = Product(
                code='L3-BODY-STR',
                name='L3 Trigger Body Straight',
                type='component',
                uom='Each',
                reorder_point=original_body.reorder_point,
                reorder_qty=original_body.reorder_qty,
                lead_time_days=original_body.lead_time_days,
                is_active=True
            )
            db.add(straight_body)
            db.flush()  # Get the ID

            # Create inventory record
            inventory = Inventory(product_id=straight_body.id, on_hand=0, allocated=0)
            db.add(inventory)

            print(f"  Created L3 Trigger Body Straight (ID: {straight_body.id})")

        # Step 2: Create new finished good "L3 Trigger Assembly Straight Trigger"
        print("\nStep 2: Creating L3 Trigger Assembly Straight Trigger finished good...")

        # Get the original L3 Trigger Assembly
        original_assembly = db.query(Product).filter(Product.code == 'L3-TRIG').first()

        # Check if straight trigger already exists
        existing_straight_assembly = db.query(Product).filter(Product.code == 'L3-TRIG-STR').first()

        if existing_straight_assembly:
            print(f"  L3 Trigger Assembly Straight already exists (ID: {existing_straight_assembly.id})")
            straight_assembly = existing_straight_assembly
        else:
            straight_assembly = Product(
                code='L3-TRIG-STR',
                name='L3 Trigger Assembly Straight Trigger',
                type='finished_good',
                uom='Each',
                reorder_point=original_assembly.reorder_point if original_assembly.reorder_point else 0,
                reorder_qty=original_assembly.reorder_qty if original_assembly.reorder_qty else 0,
                lead_time_days=original_assembly.lead_time_days if original_assembly.lead_time_days else 0,
                is_active=True
            )
            db.add(straight_assembly)
            db.flush()  # Get the ID

            # Create inventory record
            inventory = Inventory(product_id=straight_assembly.id, on_hand=0, allocated=0)
            db.add(inventory)

            print(f"  Created L3 Trigger Assembly Straight Trigger (ID: {straight_assembly.id})")

        # Step 3: Copy BOM from original assembly, replacing the trigger body
        print("\nStep 3: Creating BOM for Straight Trigger Assembly...")

        # Delete existing BOM lines for straight assembly (if re-running)
        db.query(BOMLine).filter(BOMLine.parent_product_id == straight_assembly.id).delete()

        # Get original BOM
        original_bom = db.query(BOMLine).filter(BOMLine.parent_product_id == original_assembly.id).all()

        components_added = 0
        for original_line in original_bom:
            # If this is the L3 Trigger Body, swap it for the straight version
            if original_line.component_product_id == original_body.id:
                new_line = BOMLine(
                    parent_product_id=straight_assembly.id,
                    component_product_id=straight_body.id,
                    quantity_per=original_line.quantity_per
                )
                db.add(new_line)
                print(f"  Replaced L3-BODY with L3-BODY-STR: {float(original_line.quantity_per)} Each")
                components_added += 1
            else:
                # Copy as-is
                component = original_line.component_product
                new_line = BOMLine(
                    parent_product_id=straight_assembly.id,
                    component_product_id=original_line.component_product_id,
                    quantity_per=original_line.quantity_per
                )
                db.add(new_line)
                print(f"  Added {component.code}: {float(original_line.quantity_per)} {component.uom}")
                components_added += 1

        db.commit()

        print(f"\nSuccess!")
        print(f"  - Created component: L3-BODY-STR (L3 Trigger Body Straight)")
        print(f"  - Created finished good: L3-TRIG-STR (L3 Trigger Assembly Straight Trigger)")
        print(f"  - BOM copied with {components_added} components")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_straight_trigger()
