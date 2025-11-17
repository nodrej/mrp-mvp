import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
from models import WeeklyShipment, Product

db = SessionLocal()

try:
    product = db.query(Product).filter(Product.code == 'FRT-15L3').first()

    if product:
        goals = db.query(WeeklyShipment).filter(
            WeeklyShipment.product_id == product.id
        ).order_by(WeeklyShipment.week_start_date).all()

        print(f'Found {len(goals)} weekly goals for {product.name}:\n')

        for g in goals:
            print(f'{g.week_start_date}: Goal={g.goal}, Shipped={g.shipped}')
    else:
        print('Product not found')

finally:
    db.close()
