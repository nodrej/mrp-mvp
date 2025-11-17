from database import SessionLocal
import models

db = SessionLocal()

try:
    products = db.query(models.Product).all()
    print(f'Total products: {len(products)}')
    print('\nProducts:')
    for p in products:
        print(f'  {p.code} - {p.name} ({p.type})')

    print('\n\nInventory counts:')
    inventory = db.query(models.Inventory).all()
    print(f'Total inventory records: {len(inventory)}')

    print('\n\nBOM lines:')
    bom = db.query(models.BOMLine).all()
    print(f'Total BOM lines: {len(bom)}')

    print('\n\nDemand records:')
    demand = db.query(models.DailyDemand).all()
    print(f'Total demand records: {len(demand)}')

finally:
    db.close()
