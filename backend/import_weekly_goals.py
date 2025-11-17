import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import datetime
from database import SessionLocal
from models import Product, WeeklyShipment
from decimal import Decimal

def parse_date(date_str):
    """Parse date from format like '8/4' to datetime"""
    try:
        # Parse as M/D format and assume 2025
        month_day = date_str.strip().split('/')
        month = int(month_day[0])
        day = int(month_day[1])
        year = 2025
        return datetime(year, month, day).date()
    except:
        return None

def import_weekly_goals():
    db = SessionLocal()

    try:
        # Get the L3 Trigger Assembly product
        product = db.query(Product).filter(Product.code == "FRT-15L3").first()

        if not product:
            print("Error: L3 Trigger Assembly (FRT-15L3) not found in database")
            return

        print(f"Found product: {product.name} (ID: {product.id})")

        # Parse the provided data
        dates_str = "8/4\t8/11\t8/18\t8/25\t9/1\t9/8\t9/15\t9/22\t9/29\t10/6\t10/13\t10/20\t10/27\t11/3\t11/10"
        goals_str = "100\t1500\t1500\t1500\t2000\t2000\t1500\t1375\t1400\t1400\t1400\t2300\t2200\t1850\t1600"

        # Split by tabs
        dates = dates_str.split('\t')
        goals = goals_str.split('\t')

        weekly_goals_to_import = []

        for date_str, goal_str in zip(dates, goals):
            date_str = date_str.strip()
            goal_str = goal_str.strip()

            if not date_str or not goal_str:
                continue

            parsed_date = parse_date(date_str)

            if not parsed_date:
                continue

            if goal_str.isdigit():
                goal = int(goal_str)
                weekly_goals_to_import.append({
                    'date': parsed_date,
                    'goal': goal
                })

        print(f"\nFound {len(weekly_goals_to_import)} weekly goals to import")

        if weekly_goals_to_import:
            # Sort by date
            weekly_goals_to_import.sort(key=lambda x: x['date'])
            print(f"Date range: {weekly_goals_to_import[0]['date']} to {weekly_goals_to_import[-1]['date']}")
            print(f"Total goal units: {sum(s['goal'] for s in weekly_goals_to_import):,}")

        # Delete existing weekly goals for this product in the date range
        if weekly_goals_to_import:
            dates = [s['date'] for s in weekly_goals_to_import]
            deleted = db.query(WeeklyShipment).filter(
                WeeklyShipment.product_id == product.id,
                WeeklyShipment.week_start_date.in_(dates)
            ).delete(synchronize_session=False)

            if deleted > 0:
                print(f"\nDeleted {deleted} existing weekly goal records")

        # Insert new weekly goal records
        imported_count = 0
        for goal_data in weekly_goals_to_import:
            db_weekly_goal = WeeklyShipment(
                product_id=product.id,
                week_start_date=goal_data['date'],
                goal=Decimal(str(goal_data['goal'])),
                shipped=Decimal('0'),
                notes='Imported weekly goal'
            )
            db.add(db_weekly_goal)
            imported_count += 1

        db.commit()
        print(f"\nSuccessfully imported {imported_count} weekly goal records!")

    except Exception as e:
        print(f"Error importing weekly goals: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import_weekly_goals()
