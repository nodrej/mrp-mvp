import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import datetime
from database import SessionLocal
from models import Product, SalesHistory
from decimal import Decimal

def parse_date(date_str):
    """Parse date from format like '8/4/25' to datetime"""
    try:
        # Parse as M/D/YY format
        return datetime.strptime(date_str.strip(), '%m/%d/%y').date()
    except:
        return None

def import_sales_data():
    db = SessionLocal()

    try:
        # Get the L3 Trigger Assembly product
        product = db.query(Product).filter(Product.code == "FRT-15L3").first()

        if not product:
            print("Error: L3 Trigger Assembly (FRT-15L3) not found in database")
            return

        print(f"Found product: {product.name} (ID: {product.id})")

        # Parse the provided data
        dates_str = "8/8/25	8/11/25	8/12/25	8/13/25	8/14/25	8/15/25	8/18/25	8/19/25	8/20/25	8/21/25	8/22/25	8/25/25	8/26/25	8/27/25	8/28/25	8/29/25	9/1/25	9/2/25	9/3/25	9/4/25	9/5/25	9/8/25	9/9/25	9/10/25	9/11/25	9/12/25	9/15/25	9/16/25	9/17/25	9/18/25	9/19/25	9/22/25	9/23/25	9/24/25	9/25/25	9/26/25	9/29/25	9/30/25	10/1/25	10/2/25	10/3/25	10/6/25	10/7/25	10/8/25	10/9/25	10/10/25	10/13/25	10/14/25	10/15/25	10/16/25	10/17/25	10/20/25	10/21/25	10/22/25	10/23/25	10/24/25	10/27/25	10/28/25	10/29/25	10/30/25	10/31/25	11/3/25	11/4/25	11/5/25	11/6/25	11/7/25	11/10/25	11/11/25	11/12/25	11/13/25	11/14/25"
        quantities_str = "144	600	493	280	60	60	300	203	312	360	325	304	300	298	299	299	400	188	283	570	499	348	200	301	380	230	1	412	404	231	259	96	139	167	56	924	214	41	305	300	460	71	353	254	260	319	123	363	0	377	516	260	330	481	541	594	164	476	391	526	300	324	332	495	242	485	330	39	228	448	234"

        # Split by tabs
        dates = dates_str.split('\t')
        quantities = quantities_str.split('\t')

        sales_to_import = []

        for date_str, qty_str in zip(dates, quantities):
            date_str = date_str.strip()
            qty_str = qty_str.strip()

            if not date_str or not qty_str:
                continue

            parsed_date = parse_date(date_str)

            if not parsed_date:
                continue

            if qty_str.isdigit():
                quantity = int(qty_str)
                sales_to_import.append({
                    'date': parsed_date,
                    'quantity': quantity
                })

        print(f"\nFound {len(sales_to_import)} sales records to import")

        if sales_to_import:
            # Sort by date
            sales_to_import.sort(key=lambda x: x['date'])
            print(f"Date range: {sales_to_import[0]['date']} to {sales_to_import[-1]['date']}")
            print(f"Total units sold: {sum(s['quantity'] for s in sales_to_import)}")

        # Delete existing sales for this product in the date range
        if sales_to_import:
            dates = [s['date'] for s in sales_to_import]
            deleted = db.query(SalesHistory).filter(
                SalesHistory.product_id == product.id,
                SalesHistory.sale_date.in_(dates)
            ).delete(synchronize_session=False)

            if deleted > 0:
                print(f"\nDeleted {deleted} existing sales records")

        # Insert new sales records
        imported_count = 0
        for sale in sales_to_import:
            db_sale = SalesHistory(
                product_id=product.id,
                sale_date=sale['date'],
                quantity_sold=Decimal(str(sale['quantity'])),
                notes='Imported from L3 Sold CSV'
            )
            db.add(db_sale)
            imported_count += 1

        db.commit()
        print(f"\nSuccessfully imported {imported_count} sales records!")

    except Exception as e:
        print(f"Error importing sales data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import_sales_data()
