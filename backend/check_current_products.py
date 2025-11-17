from database import SessionLocal
import models

db = SessionLocal()

try:
    print("=== CURRENT PRODUCTS ===\n")
    products = db.query(models.Product).all()
    for p in products:
        print(f"ID: {p.id:3d} | Code: {p.code:20s} | Name: {p.name:50s} | Type: {p.type}")

    print("\n=== EXISTING BOM LINES ===\n")
    bom_lines = db.query(models.BOMLine).all()
    for bom in bom_lines:
        parent = db.query(models.Product).filter(models.Product.id == bom.parent_product_id).first()
        component = db.query(models.Product).filter(models.Product.id == bom.component_product_id).first()
        if parent and component:
            print(f"{parent.code:20s} -> {component.code:20s} x {bom.quantity_per}")

finally:
    db.close()
