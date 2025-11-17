import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
import models

db = SessionLocal()

try:
    # Check MR3 products
    mr3_str = db.query(models.Product).filter(models.Product.code == "MR3-TRIG-STR").first()
    mr3_curv = db.query(models.Product).filter(models.Product.code == "MR3-TRIG-CURV").first()

    print("=== MR3 PRODUCTS ===")
    print(f"MR3-TRIG-STR: {mr3_str.name} (ID: {mr3_str.id})")
    print(f"MR3-TRIG-CURV: {mr3_curv.name} (ID: {mr3_curv.id})")

    # Check BOMs
    print("\n=== MR3-TRIG-STR BOM ===")
    str_bom = db.query(models.BOMLine).filter(models.BOMLine.parent_product_id == mr3_str.id).all()
    for bom in str_bom:
        component = db.query(models.Product).filter(models.Product.id == bom.component_product_id).first()
        print(f"  {component.code:20s} x {bom.quantity_per}")
    print(f"Total: {len(str_bom)} components")

    print("\n=== MR3-TRIG-CURV BOM ===")
    curv_bom = db.query(models.BOMLine).filter(models.BOMLine.parent_product_id == mr3_curv.id).all()
    for bom in curv_bom:
        component = db.query(models.Product).filter(models.Product.id == bom.component_product_id).first()
        print(f"  {component.code:20s} x {bom.quantity_per}")
    print(f"Total: {len(curv_bom)} components")

finally:
    db.close()
