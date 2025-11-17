from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List, Dict, Tuple
from decimal import Decimal
import math
import models
import schemas

class MRPEngine:
    """Simple MRP calculation engine"""

    def __init__(self, db: Session):
        self.db = db

    def round_up_to_lot_size(self, qty: Decimal, lot_size: Decimal, minimum: Decimal) -> Decimal:
        """
        Round quantity up to nearest lot size

        Args:
            qty: Quantity needed
            lot_size: Order multiple (must order in multiples of this)
            minimum: Minimum order quantity

        Returns:
            Rounded quantity
        """
        if qty <= 0:
            return Decimal(0)

        # Ensure we meet minimum order quantity
        if qty < minimum:
            qty = minimum

        # Round up to nearest lot size
        if lot_size > 0:
            multiplier = math.ceil(float(qty) / float(lot_size))
            return Decimal(multiplier) * lot_size

        return qty

    def calculate_reorder_point(self, product: models.Product, average_daily_usage: Decimal) -> Decimal:
        """
        Calculate reorder point = (Lead Time × Daily Usage) + Safety Stock

        Args:
            product: Product object
            average_daily_usage: Average daily usage quantity

        Returns:
            Calculated reorder point
        """
        lead_time_days = Decimal(product.lead_time_days or 0)
        safety_stock = product.safety_stock or Decimal(0)

        lead_time_demand = average_daily_usage * lead_time_days
        reorder_point = lead_time_demand + safety_stock

        return reorder_point

    def explode_bom_recursive(self, product_id: int, demand_qty: Decimal, level: int = 0) -> Dict[int, Decimal]:
        """
        Recursively explode BOM for multi-level assemblies

        Args:
            product_id: Parent product ID
            demand_qty: Quantity of parent product needed
            level: Recursion level (to prevent infinite loops)

        Returns:
            Dictionary of {component_id: total_quantity_required}
        """
        if level > 10:  # Prevent infinite recursion
            raise ValueError(f"BOM nesting too deep (>10 levels) for product {product_id}")

        requirements = {}

        # Get BOM lines for this product
        bom_lines = self.db.query(models.BOMLine).filter(
            models.BOMLine.parent_product_id == product_id
        ).all()

        for line in bom_lines:
            component = line.component_product
            required_qty = demand_qty * line.quantity_per

            if component.type == 'sub_assembly':
                # Recursively explode sub-assembly
                sub_reqs = self.explode_bom_recursive(component.id, required_qty, level + 1)
                for comp_id, qty in sub_reqs.items():
                    requirements[comp_id] = requirements.get(comp_id, Decimal(0)) + qty
            else:
                # Leaf component (component or raw_material)
                requirements[component.id] = requirements.get(component.id, Decimal(0)) + required_qty

        return requirements

    def calculate_mrp(self, days: int = 30) -> Dict:
        """
        Run MRP calculation for all products

        Args:
            days: Number of days to project forward

        Returns:
            Dictionary with calculation results and alerts
        """
        print(f"Starting MRP calculation for {days} days...")

        # Clear previous MRP results
        self.db.query(models.MRPResult).delete()
        self.db.commit()

        # Get all active finished goods
        finished_goods = self.db.query(models.Product).filter(
            models.Product.type == 'finished_good',
            models.Product.is_active == True
        ).all()

        print(f"Found {len(finished_goods)} finished goods to process")

        # Track all component requirements across all products
        total_component_requirements = {}

        # Process each finished good
        for product in finished_goods:
            print(f"Processing product: {product.code}")

            # Get demand for this product
            demand_data = self.get_demand_forecast(product.id, days)

            # Explode BOM to get component requirements
            component_reqs = self.explode_bom(product.id, demand_data)

            # Accumulate component requirements
            for comp_id, daily_reqs in component_reqs.items():
                if comp_id not in total_component_requirements:
                    total_component_requirements[comp_id] = {}

                for day, qty in daily_reqs.items():
                    total_component_requirements[comp_id][day] = \
                        total_component_requirements[comp_id].get(day, Decimal(0)) + qty

        print(f"Component requirements calculated for {len(total_component_requirements)} components")

        # Now calculate projected inventory for each component
        shortages = []
        for component_id, daily_reqs in total_component_requirements.items():
            component = self.db.query(models.Product).filter(models.Product.id == component_id).first()
            if not component:
                continue

            # Get current inventory
            inventory = self.db.query(models.Inventory).filter(
                models.Inventory.product_id == component_id
            ).first()

            on_hand = float(inventory.on_hand) if inventory else 0.0
            projected = on_hand

            # Calculate day by day
            start_date = date.today()
            shortage_detected = False
            shortage_date = None

            for day_offset in range(days):
                current_date = start_date + timedelta(days=day_offset)
                day_requirement = float(daily_reqs.get(day_offset, Decimal(0)))

                # Subtract daily requirement
                projected -= day_requirement

                # Save MRP result for this day
                mrp_result = models.MRPResult(
                    product_id=component_id,
                    result_date=current_date,
                    projected_onhand=Decimal(str(projected)),
                    needs_ordering=(projected < float(component.reorder_point)),
                    shortage_date=current_date if projected < 0 else None
                )
                self.db.add(mrp_result)

                # Check for shortage
                if projected < 0 and not shortage_detected:
                    shortage_detected = True
                    shortage_date = current_date
                    shortages.append({
                        'product_id': component_id,
                        'product_code': component.code,
                        'product_name': component.name,
                        'shortage_date': shortage_date,
                        'projected_inventory': projected,
                        'reorder_point': float(component.reorder_point),
                        'reorder_qty': float(component.reorder_qty)
                    })

        self.db.commit()
        print(f"MRP calculation complete. Found {len(shortages)} shortages")

        return {
            'shortages': shortages,
            'products_processed': len(finished_goods),
            'components_analyzed': len(total_component_requirements)
        }

    def explode_bom(self, product_id: int, demand_data: Dict[int, Decimal]) -> Dict[int, Dict[int, Decimal]]:
        """
        Explode BOM for a product given its demand forecast (with multi-level support)

        Args:
            product_id: Product to explode
            demand_data: Dictionary of {day_offset: quantity}

        Returns:
            Dictionary of {component_id: {day_offset: quantity_required}}
        """
        component_requirements = {}

        # For each day's demand, explode BOM recursively
        for day_offset, demand_qty in demand_data.items():
            if demand_qty > 0:
                # Use recursive BOM explosion to handle sub-assemblies
                daily_reqs = self.explode_bom_recursive(product_id, demand_qty)

                # Accumulate requirements by day
                for component_id, qty in daily_reqs.items():
                    if component_id not in component_requirements:
                        component_requirements[component_id] = {}
                    component_requirements[component_id][day_offset] = qty

        return component_requirements

    def get_demand_forecast(self, product_id: int, days: int) -> Dict[int, Decimal]:
        """
        Get demand forecast for a product

        Args:
            product_id: Product ID
            days: Number of days to forecast

        Returns:
            Dictionary of {day_offset: quantity}
        """
        demand_data = {}
        start_date = date.today()

        for day_offset in range(days):
            current_date = start_date + timedelta(days=day_offset)

            # Look up demand in database
            demand = self.db.query(models.DailyDemand).filter(
                models.DailyDemand.product_id == product_id,
                models.DailyDemand.demand_date == current_date
            ).first()

            demand_data[day_offset] = demand.quantity if demand else Decimal(0)

        return demand_data

    def get_shortages(self, days: int = 14) -> List[schemas.ShortageAlert]:
        """
        Get all products with shortages accounting for lead time

        Args:
            days: Number of days to look ahead

        Returns:
            List of shortage alerts with order-by dates and recommended quantities
        """
        cutoff_date = date.today() + timedelta(days=days)

        shortages = []
        shortage_results = self.db.query(models.MRPResult).filter(
            models.MRPResult.needs_ordering == True,
            models.MRPResult.result_date <= cutoff_date
        ).all()

        # Group by product (only show earliest shortage)
        product_shortages = {}
        for result in shortage_results:
            if result.product_id not in product_shortages:
                product_shortages[result.product_id] = result
            elif result.result_date < product_shortages[result.product_id].result_date:
                product_shortages[result.product_id] = result

        # Build shortage alerts
        for product_id, result in product_shortages.items():
            product = result.product
            inventory = self.db.query(models.Inventory).filter(
                models.Inventory.product_id == product_id
            ).first()

            lead_time = product.lead_time_days or 0
            shortage_date = result.shortage_date or result.result_date

            # Calculate effective order-by date (shortage date - lead time)
            order_by_date = shortage_date - timedelta(days=lead_time)

            # Only alert if we need to order NOW to avoid shortage
            if order_by_date <= date.today() + timedelta(days=days):
                # Calculate recommended order quantity with lot sizing
                base_order_qty = product.reorder_qty or Decimal(0)

                # Apply lot sizing
                order_multiple = product.order_multiple or Decimal(1)
                minimum_order = product.minimum_order_qty or Decimal(0)
                recommended_qty = self.round_up_to_lot_size(
                    base_order_qty,
                    order_multiple,
                    minimum_order
                )

                shortages.append(schemas.ShortageAlert(
                    product_id=product.id,
                    product_code=product.code,
                    product_name=product.name,
                    on_hand=inventory.on_hand if inventory else Decimal(0),
                    shortage_date=shortage_date,
                    order_by_date=order_by_date,
                    reorder_point=product.reorder_point,
                    reorder_qty=product.reorder_qty,
                    recommended_order_qty=recommended_qty,
                    lead_time_days=lead_time
                ))

        # Sort by order_by_date (most urgent first)
        shortages.sort(key=lambda x: x.order_by_date)

        return shortages

    def get_dashboard_data(self) -> schemas.DashboardData:
        """Get summary data for dashboard based on weekly shipment goals"""
        from collections import defaultdict

        # Get all active products
        all_products = self.db.query(models.Product).filter(
            models.Product.is_active == True
        ).all()

        # Count products and components
        total_products = sum(1 for p in all_products if p.type == 'finished_good')
        total_components = sum(1 for p in all_products if p.type == 'component')

        # Count inventory items (only for active products)
        # Use a join to ensure we only count inventory for products that are currently active
        total_inventory_value = self.db.query(models.Inventory).join(
            models.Product,
            models.Inventory.product_id == models.Product.id
        ).filter(
            models.Product.is_active == True
        ).count()

        # Count products by status
        low_stock_count = 0

        for product in all_products:
            inventory = self.db.query(models.Inventory).filter(
                models.Inventory.product_id == product.id
            ).first()

            if not inventory:
                continue

            on_hand = float(inventory.on_hand)
            reorder_point = float(product.reorder_point) if product.reorder_point else 0

            if reorder_point > 0 and on_hand < reorder_point:
                low_stock_count += 1

        # Calculate projected shortages based on weekly shipment goals (next 90 days)
        days = 90
        start_date = date.today()
        dates = [start_date + timedelta(days=i) for i in range(days)]

        # Get weekly shipment goals
        week_starts = set()
        for d in dates:
            week_start = d - timedelta(days=d.weekday())
            week_starts.add(week_start)

        all_shipments = self.db.query(models.WeeklyShipment).filter(
            models.WeeklyShipment.week_start_date.in_(list(week_starts))
        ).all()

        # Group shipments by product_id and week
        shipments_by_product = defaultdict(dict)
        for s in all_shipments:
            shipments_by_product[s.product_id][s.week_start_date] = float(s.goal)

        # Calculate daily production targets for EACH product
        daily_production_by_product = defaultdict(dict)
        for product_id, weekly_goals in shipments_by_product.items():
            for d in dates:
                week_start = d - timedelta(days=d.weekday())
                weekly_goal = weekly_goals.get(week_start, 0)
                # Only produce on weekdays (Mon-Fri)
                if d.weekday() < 5:  # 0-4 are Mon-Fri
                    daily_production_by_product[product_id][d] = weekly_goal / 5
                else:
                    daily_production_by_product[product_id][d] = 0

        # Get ALL BOM lines
        all_bom_lines = self.db.query(models.BOMLine).all()

        # Group BOM lines by component
        component_usage = defaultdict(list)
        for bom_line in all_bom_lines:
            component_usage[bom_line.component_product_id].append({
                'parent_product_id': bom_line.parent_product_id,
                'quantity_per': float(bom_line.quantity_per)
            })

        # Get all components
        all_components = self.db.query(models.Product).filter(
            models.Product.type == 'component',
            models.Product.is_active == True
        ).all()

        # Find components with shortages
        formatted_shortages = []
        for component in all_components:
            if component.id not in component_usage:
                continue

            # Get current inventory
            inventory = self.db.query(models.Inventory).filter(
                models.Inventory.product_id == component.id
            ).first()
            current_stock = float(inventory.on_hand) if inventory else 0

            # Calculate daily consumption and projected inventory
            running_inventory = current_stock
            run_out_date = None

            for d in dates:
                total_consumption = 0

                # Sum consumption from ALL products that use this component
                for usage in component_usage[component.id]:
                    parent_product_id = usage['parent_product_id']
                    quantity_per = usage['quantity_per']

                    if parent_product_id in daily_production_by_product:
                        production = daily_production_by_product[parent_product_id].get(d, 0)
                        consumption = production * quantity_per
                        total_consumption += consumption

                running_inventory -= total_consumption

                # Record when we first go negative
                if run_out_date is None and running_inventory < 0:
                    run_out_date = d
                    break

            # If component will run out in the next 90 days, add to shortages
            if run_out_date:
                days_until_runout = (run_out_date - start_date).days
                severity = 'critical' if days_until_runout < 7 else 'warning' if days_until_runout < 30 else 'info'

                formatted_shortages.append({
                    'product_code': component.code,
                    'product_name': component.name,
                    'current_stock': current_stock,
                    'projected_shortage_date': run_out_date.isoformat(),
                    'days_until_shortage': days_until_runout,
                    'severity': severity
                })

        # Sort by days until shortage (most urgent first)
        formatted_shortages.sort(key=lambda x: x['days_until_shortage'])

        # Take top 15 most urgent
        formatted_shortages = formatted_shortages[:15]

        return schemas.DashboardData(
            total_products=total_products,
            total_components=total_components,
            total_inventory_value=total_inventory_value,
            low_stock_count=low_stock_count,
            shortages=formatted_shortages
        )
